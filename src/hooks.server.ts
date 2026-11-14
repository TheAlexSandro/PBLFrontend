type Resolve = (event: any) => Promise<Response>;
type HandleInput = { event: any; resolve: Resolve };
import { ALLOWED_ORIGINS } from '$app/env/private';

const allowedOrigin = ALLOWED_ORIGINS.split(',');

const CORS = {
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, X-Scanner-Key, X-App-Version',
	'Access-Control-Max-Age': '86400',
	Vary: 'Origin'
};

export const handle = async ({ event, resolve }: HandleInput) => {
	if (!event.url.pathname.startsWith('/api/')) return resolve(event);

	const origin: string | null = event.request.headers.get('origin');
	const allowed = origin !== null && allowedOrigin.includes(origin);

	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: allowed ? { ...CORS, 'Access-Control-Allow-Origin': origin } : { Vary: 'Origin' }
		});
	}

	const res = await resolve(event);
	if (allowed) {
		res.headers.set('Access-Control-Allow-Origin', origin);
		res.headers.append('Vary', 'Origin');
	}
	return res;
};
