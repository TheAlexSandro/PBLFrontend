import { io } from 'socket.io-client';
import { PUBLIC_API_URL } from '$app/env/public';
import { proxyPost } from './api';

export type StreamState = 'connecting' | 'waiting' | 'live' | 'error';
export type Scanner = { deviceId: string; label: string };

type Options = {
	getImage: (deviceId: string) => HTMLImageElement | null | undefined;
	onScanners: (list: Scanner[]) => void;
	onState: (deviceId: string | null, s: StreamState) => void;
};

const STALE_MS = 5000;

async function requestConnect(): Promise<string | null> {
	try {
		const t: any = await proxyPost({ path: 'auth', ep: 'requestConnect' });
		return t?.['ws.access'] ?? null;
	} catch (e) {
		console.error('gagal ambil ticket:', e);
		return null;
	}
}

export async function watchStreams({ getImage, onScanners, onState }: Options) {
	let scanners: Scanner[] = [];
	const watched = new Set<string>();
	const urls = new Map<string, string>();
	const lastAt = new Map<string, number>();

	onState(null, 'connecting');

	const wsToken = await requestConnect();
	if (!wsToken) {
		onState(null, 'error');
		return { stop: () => {} };
	}

	const socket = io(`${PUBLIC_API_URL}/stream`, {
		auth: { wsToken },
		reconnection: true,
		transports: ['websocket']
	});

	const clear = (id: string) => {
		try {
			getImage(id)?.removeAttribute('src');
		} catch {}
		const u = urls.get(id);
		if (u) URL.revokeObjectURL(u);
		urls.delete(id);
		lastAt.delete(id);
	};

	const sync = () => {
		const online = new Set(scanners.map((s) => s.deviceId));

		for (const id of online) {
			if (watched.has(id)) continue;
			watched.add(id);
			socket.emit('watch', id);
			onState(id, 'waiting');
		}
		for (const id of [...watched]) {
			if (online.has(id)) continue;
			watched.delete(id);
			socket.emit('unwatch', id);
			clear(id);
		}
	};

	socket.on('connect', () => {
		watched.clear();
		onState(null, 'waiting');
	});
	socket.on('connect_error', () => onState(null, 'error'));
	socket.on('disconnect', () => {
		for (const id of [...urls.keys()]) {
			clear(id);
			onState(id, 'waiting');
		}
	});

	socket.on('scanners', (list: Scanner[]) => {
		scanners = list;
		onScanners(scanners);
		sync();
	});
	socket.on('scanner-online', (s: Scanner) => {
		scanners = [...scanners.filter((x) => x.deviceId !== s.deviceId), s];
		onScanners(scanners);
		sync();
	});
	socket.on('scanner-offline', ({ deviceId }: { deviceId: string }) => {
		scanners = scanners.filter((s) => s.deviceId !== deviceId);
		onScanners(scanners);
		sync();
	});
	socket.on('watch-error', (e: { deviceId?: string; reason?: string }) => {
		if (e?.deviceId) {
			watched.delete(e.deviceId);
			onState(e.deviceId, 'error');
		}
	});

	socket.on('frame', (deviceId: string, buf: ArrayBuffer) => {
		if (typeof deviceId !== 'string' || !(buf instanceof ArrayBuffer)) return;
		const img = getImage(deviceId);
		if (!img) return;

		const url = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }));
		img.src = url;

		const old = urls.get(deviceId);
		if (old) URL.revokeObjectURL(old);
		urls.set(deviceId, url);

		lastAt.set(deviceId, Date.now());
		onState(deviceId, 'live');
	});

	const timer = setInterval(() => {
		const now = Date.now();
		for (const [id, t] of lastAt) {
			if (now - t > STALE_MS) {
				lastAt.delete(id);
				onState(id, 'waiting');
			}
		}
	}, 2000);

	return {
		stop: () => {
			clearInterval(timer);
			for (const id of [...urls.keys()]) clear(id);
			socket.disconnect();
		}
	};
}
