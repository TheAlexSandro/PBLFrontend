type Params = Record<string, string | number | undefined>;

export class ApiError extends Error {
	status?: number;
	constructor(message: string, status?: number) {
		super(message);
		this.status = status;
	}
}

type Options = {
	method?: 'GET' | 'POST';
	body?: unknown;
	signal?: AbortSignal;
	redirectOn401?: boolean;
};

async function request<T>(params: Params, opts: Options = {}): Promise<T> {
	const { method = 'GET', body, signal, redirectOn401 = true } = opts;

	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== '') qs.set(k, String(v));
	}

	const res = await fetch(`/api/proxy?${qs}`, {
		method,
		signal,
		...(body !== undefined && {
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	});

	if (res.status === 401) {
		if (redirectOn401) {
			window.location.href = '/auth';
			throw new ApiError('Sesi berakhir', 401);
		}
		throw new ApiError('Tidak diizinkan', 401);
	}
	const json = await res.json().catch(() => null);
	if (!res.ok)
		throw new ApiError(
			json['message'] ? `Error: ${json['message']}` : `Internal server error.`,
			res.status
		);
	if (json?.ok === false) throw new ApiError(json?.message ?? 'Permintaan gagal', res.status);
	return json?.result as T;
}

export function proxyGet<T>(params: Params, signal?: AbortSignal): Promise<T> {
	return request<T>(params, { signal });
}

export function proxyPost<T>(
	params: Params,
	body?: unknown,
	opts: { signal?: AbortSignal; redirectOn401?: boolean } = {}
): Promise<T> {
	return request<T>(params, { ...opts, method: 'POST', body });
}
