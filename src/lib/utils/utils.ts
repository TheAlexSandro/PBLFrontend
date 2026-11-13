import { proxyGet } from './api';

export const isLoggedIn = async (redirectOn401?: boolean) => {
	try {
		const res: any = await proxyGet({ path: 'auth', ep: 'isLoggedIn' }, { redirectOn401 });
		if (!res?.ok) return false;
		if (res?.['status_code'] !== 200) return false;
		return true;
	} catch (e) {
		return false;
	}
};

export const fmtDate = (v: unknown) => {
	let s = String(v ?? '').trim();
	if (!s) return '-';
	if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = `${s.replace(' ', 'T')}Z`;

	const d = new Date(s);
	return Number.isNaN(d.getTime())
		? '-'
		: d.toLocaleString('id-ID', {
				dateStyle: 'medium',
				timeStyle: 'short',
				timeZone: 'Asia/Jakarta'
			});
};
