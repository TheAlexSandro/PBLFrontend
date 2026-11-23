import { io, type Socket } from 'socket.io-client';
import { PUBLIC_API_URL } from '$app/env/public';
import { proxyPost } from './api';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';
type Fn = (...args: any[]) => void;

const MAX_RETRIES = 5;
const RETRY_MS = 3000;
const GRACE_MS = 3000;

let socket: Socket | null = null;
let status: RealtimeStatus = 'connecting';
let refs = 0;
let retries = 0;
let wasConnected = false;
let starting = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let graceTimer: ReturnType<typeof setTimeout> | undefined;

const events = new Map<string, Set<Fn>>();
const statusFns = new Set<(s: RealtimeStatus) => void>();
const reconnectFns = new Set<() => void>();

function setStatus(s: RealtimeStatus) {
	if (s === status) return;
	status = s;
	statusFns.forEach((f) => f(s));
}

async function requestConnect(): Promise<string | null> {
	try {
		const t: any = await proxyPost({ path: 'auth', ep: 'requestConnect' });
		return t?.['ws.access'] ?? null;
	} catch (e) {
		console.error('gagal ambil ticket:', e);
		return null;
	}
}

async function start() {
	if (socket || starting || refs === 0) return;

	starting = true;
	const wsToken = await requestConnect();
	starting = false;

	if (refs === 0) return;
	if (!wsToken) {
		setStatus('disconnected');
		return;
	}

	const s = io(`${PUBLIC_API_URL}/stats`, {
		auth: { wsToken },
		reconnection: true,
		transports: ['websocket']
	});
	socket = s;
	s.onAny((event: string, ...args: any[]) => events.get(event)?.forEach((f) => f(...args)));

	s.on('connect', () => {
		retries = 0;
		setStatus('connected');
		if (wasConnected) reconnectFns.forEach((f) => f());
		wasConnected = true;
	});

	s.on('disconnect', () => {
		socket = null;
		s.close();
		setStatus('disconnected');
		if (refs > 0 && retries++ < MAX_RETRIES) retryTimer = setTimeout(() => void start(), RETRY_MS);
	});

	s.on('connect_error', (err) => console.error('WS connect_error:', err.message));
}

function teardown() {
	if (retryTimer) clearTimeout(retryTimer);
	socket?.offAny();
	socket?.removeAllListeners();
	socket?.disconnect();
	socket = null;
	wasConnected = false;
	retries = 0;
	setStatus('connecting');
}

export function realtime() {
	refs++;
	if (graceTimer) clearTimeout(graceTimer);
	retries = 0;
	void start();

	const offs: (() => void)[] = [];
	let closed = false;

	return {
		on(event: string, fn: Fn) {
			const set = events.get(event) ?? new Set<Fn>();
			events.set(event, set);
			set.add(fn);
			offs.push(() => set.delete(fn));
		},
		onStatus(fn: (s: RealtimeStatus) => void) {
			statusFns.add(fn);
			offs.push(() => statusFns.delete(fn));
			fn(status);
		},
		onReconnect(fn: () => void) {
			reconnectFns.add(fn);
			offs.push(() => reconnectFns.delete(fn));
		},
		close() {
			if (closed) return;
			closed = true;
			offs.forEach((off) => off());
			if (--refs === 0) {
				graceTimer = setTimeout(() => {
					if (refs === 0) teardown();
				}, GRACE_MS);
			}
		}
	};
}
