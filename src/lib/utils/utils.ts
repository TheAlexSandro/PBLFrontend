export const isLoggedIn = async () => {
	const res = await fetch('/api/proxy?path=admin&ep=isLoggedIn');
	if (!res.ok) return false;
	const resJson = await res.json();
	if (resJson['status_code'] !== 200) return false;
	return true;
};
