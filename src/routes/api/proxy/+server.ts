import { API_URL } from '$app/env/private';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const FORWARD_HEADERS: string[] = ['X-Scanner-Key', 'X-App-Version'];

const proxy: RequestHandler = async ({ url, request }) => {
	const path = url.searchParams.get('path');
	const ep = url.searchParams.get('ep');

	if (!path || !ep || !SAFE_SEGMENT.test(path) || !SAFE_SEGMENT.test(ep)) {
		error(400, 'Invalid path or endpoint');
	}

	const forwarded = new URLSearchParams(url.searchParams);
	forwarded.delete('path');
	forwarded.delete('ep');
	const query = forwarded.toString();

	const base = API_URL.replace(/\/+$/, '');
	const targetUrl = `${base}/${path}/${ep}${query ? `?${query}` : ''}`;

	const headers = new Headers({
		Accept: 'application/json',
		Cookie: request.headers.get('cookie') ?? ''
	});

	for (const name of FORWARD_HEADERS) {
		const value = request.headers.get(name);
		if (value !== null) headers.set(name, value);
	}

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	if (hasBody) {
		headers.set('Content-Type', request.headers.get('content-type') ?? 'application/json');
	}

	const rawBody = hasBody ? await request.text() : '';
	if (rawBody) {
		headers.set('Content-Type', request.headers.get('content-type') ?? 'application/json');
	}

	const upstream = await fetch(targetUrl, {
		method: request.method,
		headers,
		body: rawBody || undefined
	});

	const response = new Response(await upstream.text(), {
		status: upstream.status,
		headers: {
			'Content-Type': upstream.headers.get('content-type') ?? 'application/json'
		}
	});

	for (const cookie of upstream.headers.getSetCookie()) {
		response.headers.append('set-cookie', cookie);
	}

	return response;
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
