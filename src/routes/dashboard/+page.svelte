<script lang="ts">
	import Navbar from '#lib/components/navbar.svelte';
	import Footer from '#lib/components/footer.svelte';
	import Load from '#lib/components/load.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { isLoggedIn, fmtDate } from '#lib/utils/utils.ts';
	import { proxyGet, proxyPost } from '#lib/utils/api.ts';
	import { io, type Socket } from 'socket.io-client';
	import { PUBLIC_API_URL } from '$app/env/public';

	type Stats = {
		total: number;
		scanned: number;
		notScanned: number;
		perYear: { year: number; scanned: number }[];
	};

	type Log = {
		id: number;
		code: string;
		ticketId: string | null;
		result: 'VALID' | 'ALREADY_SCANNED' | 'NOT_FOUND';
		createdAt?: string;
	};

	const cards = [
		{
			key: 'scanned',
			label: 'Tiket Dipindai',
			icon: 'ri-checkbox-circle-line',
			tone: 'var(--color-success)'
		},
		{
			key: 'notScanned',
			label: 'Belum Dipindai',
			icon: 'ri-time-line',
			tone: 'var(--color-warning)'
		},
		{ key: 'total', label: 'Total Tiket', icon: 'ri-ticket-2-line', tone: 'var(--color-primary)' }
	] as const;

	const menus = [
		{
			type: 'SCANNED',
			key: 'scanned',
			title: 'Tiket Dipindai',
			desc: 'Tiket yang sudah discan',
			icon: 'ri-checkbox-circle-line',
			tone: 'var(--color-success)'
		},
		{
			type: 'NOT_SCANNED',
			key: 'notScanned',
			title: 'Tiket Tidak Dipindai',
			desc: 'Tiket yang belum discan',
			icon: 'ri-time-line',
			tone: 'var(--color-warning)'
		},
		{
			type: 'TOTAL',
			key: 'total',
			title: 'Tiket Keseluruhan',
			desc: 'Semua tiket yang terdaftar',
			icon: 'ri-ticket-2-line',
			tone: 'var(--color-primary)'
		}
	] as const;
	const LIMIT = 10;
	const RESULT_LABEL = {
		VALID: 'Valid',
		ALREADY_SCANNED: 'Sudah discan',
		NOT_FOUND: 'Tidak ditemukan'
	} as const;

	let windowLoading = $state(true);
	let stats = $state<Stats | null>(null);
	let years = $state<number[]>([]);
	let year = $state('');
	let loading = $state(true);
	let error = $state('');
	let reqId = 0;
	let scanner = $state('');
	let scannerBusy = $state(false);
	let scannerError = $state('');
	let wsStatus = $state('connecting');
	let socket: Socket | null = null;

	let logs = $state<Log[]>([]);
	let logPage = $state(1);
	let logTotal = $state(0);
	let logLoading = $state(true);
	let logError = $state('');
	let logReq = 0;

	const logPages = $derived(Math.max(1, Math.ceil(logTotal / LIMIT)));
	const logOffset = $derived((logPage - 1) * LIMIT);
	const logFrom = $derived(logs.length ? logOffset + 1 : 0);
	const logTo = $derived(logs.length ? logOffset + logs.length : 0);

	onMount(async () => {
		const log = await isLoggedIn(true);
		if (!log) return;
		windowLoading = false;
		void loadStats();
		void loadScanner();
		void loadLogs();
		connectRealtime();
	});

	onDestroy(() => {
		socket?.disconnect();
		socket = null;
	});

	const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
	const viewHref = (type: string) => `/dashboard/view?type=${type}${year ? `&year=${year}` : ''}`;

	async function requestConnect() {
		try {
			const t: any = await proxyPost({ path: 'auth', ep: 'requestConnect' });
			return t?.['ws.access'];
		} catch (e) {
			console.error('gagal ambil ticket:', e);
			return null;
		}
	}

	let retries = 0;

	async function connectRealtime() {
		if (socket) return;

		const wsToken = await requestConnect();
		if (!wsToken) {
			wsStatus = 'disconnected';
			return;
		}

		const s = io(`${PUBLIC_API_URL}/wss`, {
			auth: { wsToken },
			reconnection: true,
			transports: ['websocket']
		});
		socket = s;

		s.on('connect', () => {
			wsStatus = 'connected';
			retries = 0;
		});

		s.on('disconnect', () => {
			wsStatus = 'disconnected';
			socket = null;
			s.close();
			if (retries++ < 5) setTimeout(() => void connectRealtime(), 3000);
		});

		s.on('connect_error', (err) => console.error('WS connect_error:', err.message));
		s.on('ticket:stats', applyStats);
		s.on('ticket:refreshLogs', applyStats);
	}

	function applyStats(s: Stats) {
		void loadLogs();
		years = [...new Set([...years, ...s.perYear.map((p) => p.year)])].sort((a, b) => b - a);

		if (!year) {
			stats = s;
			return;
		}
		const scanned = s.perYear.find((p) => p.year === Number(year))?.scanned ?? 0;
		stats = { total: s.total, scanned, notScanned: s.total - scanned, perYear: s.perYear };
	}

	async function loadScanner() {
		try {
			const st = await proxyGet({ path: 'tickets', ep: 'scannerStatus' });
			// menggunakan yes dan no karena hasilnya true/false
			scanner = (st as any)['isScannerReady'] ? 'yes' : 'no';
			scannerError = '';
		} catch (e) {
			scannerError = e instanceof Error ? e.message : 'Gagal memuat status scanner';
		}
	}

	async function toggleScanner() {
		if (!scanner || scannerBusy) return;
		scannerBusy = true;
		scannerError = '';
		try {
			await proxyPost({ path: 'tickets', ep: 'changeStatus', code: 'SCANNER_STATUS' });
			await loadScanner();
		} catch (e) {
			scannerError = e instanceof Error ? e.message : 'Gagal mengubah status scanner';
		} finally {
			scannerBusy = false;
		}
	}

	async function loadStats() {
		const id = ++reqId;
		loading = true;
		error = '';
		try {
			const data = await proxyGet<Stats>({ path: 'tickets', ep: 'stats', year });
			if (id !== reqId) return;
			stats = data;
			if (!years.length) {
				years = data.perYear.map((p) => p.year).sort((a, b) => b - a);
			}
		} catch (e) {
			if (id !== reqId) return;
			error = e instanceof Error ? e.message : 'Gagal memuat data';
		} finally {
			if (id === reqId) loading = false;
		}
	}

	function pageList(current: number, last: number): (number | '…')[] {
		if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
		const nums = [...new Set([1, last, current - 1, current, current + 1])]
			.filter((n) => n >= 1 && n <= last)
			.sort((a, b) => a - b);
		const out: (number | '…')[] = [];
		nums.forEach((n, i) => {
			if (i && n - nums[i - 1] > 1) out.push('…');
			out.push(n);
		});
		return out;
	}

	async function loadLogs() {
		const id = ++logReq;
		logLoading = true;
		try {
			const data = await proxyGet<{ total: number; logs: Log[] }>({
				path: 'admin',
				ep: 'getLogs',
				page: logPage,
				limit: LIMIT
			});
			if (id !== logReq) return;
			logs = data?.logs ?? [];
			logTotal = Number(data?.total ?? 0);
			logError = '';

			if (!logs.length && logPage > 1) {
				logPage = Math.max(1, Math.ceil(logTotal / LIMIT));
				void loadLogs();
			}
		} catch (e) {
			if (id !== logReq) return;
			logError = e instanceof Error ? e.message : 'Gagal memuat log';
		} finally {
			if (id === logReq) logLoading = false;
		}
	}

	function goLog(p: number) {
		if (p < 1 || p > logPages || p === logPage) return;
		logPage = p;
		void loadLogs();
	}

	function onYearChange(e: Event & { currentTarget: HTMLSelectElement }) {
		year = e.currentTarget.value;
		void loadStats();
	}
</script>

<svelte:head>
	<title>PBL Dashboard - SMKN 1 Blitar</title>
	<meta name="description" content="PBL Dashboard - SMKN 1 Blitar" />
</svelte:head>

{#if windowLoading}
	<Load />
{:else}
	<Navbar />

	<main class="wrap">
		<header class="head">
			<div>
				<h1>Dashboard PBL</h1>
				<p>
					Ringkasan tiket Dies Natalis SMKN 1 Blitar {#if year}
						tahun {year}
					{/if}
				</p>
			</div>

			<label class="filter">
				Tahun
				<select value={year} onchange={onYearChange}>
					<option value="">Semua tahun</option>
					{#each years as y}
						<option value={String(y)}>{y}</option>
					{/each}
				</select>
			</label>
		</header>

		{#if error}
			<div class="alert" role="alert">
				<span>{error}</span>
				<button type="button" onclick={loadStats}>Coba lagi</button>
			</div>
		{/if}

		<section class="stats" aria-label="Ringkasan tiket">
			{#each cards as c}
				<div class="stat" class:dim={loading && !!stats} style="--tone: {c.tone}">
					<span class="ico"><i class={c.icon}></i></span>
					<div>
						<div class="label">{c.label}</div>
						<div class="num">
							{#if stats}{fmt(stats[c.key])}{:else}<span class="sk"></span>{/if}
						</div>
					</div>
				</div>
			{/each}
		</section>
		<span
			class="ws"
			class:connected={wsStatus === 'connected'}
			class:connecting={wsStatus === 'connecting'}
			role="status"
		>
			<span class="dot"></span>
			{wsStatus === 'connected'
				? 'Connected - Realtime Update'
				: wsStatus === 'connecting'
					? 'Menghubungkan...'
					: 'Tidak Terhubung'}
		</span>

		<section class="logs" aria-label="Log scan">
			<h2>Log terbaru</h2>

			{#if logError}
				<div class="alert" role="alert">
					<span>{logError}</span>
					<button type="button" onclick={loadLogs}>Coba lagi</button>
				</div>
			{/if}

			<div class="table-wrap" class:dim={logLoading && logs.length > 0}>
				<table>
					<thead>
						<tr>
							<th class="no">No</th>
							<th>Waktu</th>
							<th>Kode</th>
							<th>Hasil</th>
						</tr>
					</thead>
					<tbody>
						{#if logLoading && !logs.length}
							{#each Array(5) as _}
								<tr><td colspan="4"><span class="sk-row"></span></td></tr>
							{/each}
						{:else if !logs.length}
							<tr><td colspan="4" class="empty">Belum ada log.</td></tr>
						{:else}
							{#each logs as l, i (l.id)}
								<tr>
									<td class="no">{logOffset + i + 1}</td>
									<td>{fmtDate(l.createdAt)}</td>
									<td class="mono" title={l.code}>{l.code}</td>
									<td><span class="badge {l.result}">{RESULT_LABEL[l.result] ?? l.result}</span></td
									>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>

			<footer class="pager">
				<span class="pinfo">Menampilkan {fmt(logFrom)}–{fmt(logTo)} dari {fmt(logTotal)}</span>
				<div class="pages">
					<button
						type="button"
						aria-label="Halaman sebelumnya"
						disabled={logPage <= 1}
						onclick={() => goLog(logPage - 1)}
					>
						<i class="ri-arrow-left-s-line"></i>
					</button>

					{#each pageList(logPage, logPages) as p}
						{#if p === '…'}
							<span class="gap">…</span>
						{:else}
							<button
								type="button"
								class:active={p === logPage}
								aria-current={p === logPage ? 'page' : undefined}
								onclick={() => goLog(p)}
							>
								{p}
							</button>
						{/if}
					{/each}

					<button
						type="button"
						aria-label="Halaman berikutnya"
						disabled={logPage >= logPages}
						onclick={() => goLog(logPage + 1)}
					>
						<i class="ri-arrow-right-s-line"></i>
					</button>
				</div>
			</footer>
		</section>

		<nav class="menu" aria-label="menu">
			<h2>Review</h2>
			<a class="item" href="/dashboard/review" style="--tone: var(--color-danger)">
				<span class="ico"><i class="ri-file-edit-line"></i></span>
				<span class="txt">
					<strong>Tinjau Tiket</strong>
					<small>Tinjau tiket dan finalkan agar tiket dapat digunakan</small>
				</span>
				<i class="ri-arrow-right-s-line chev"></i>
			</a>

			<h2>Lihat daftar tiket</h2>
			{#each menus as m}
				<a class="item" href={viewHref(m.type)} style="--tone: {m.tone}">
					<span class="ico"><i class={m.icon}></i></span>
					<span class="txt">
						<strong>{m.title}</strong>
						<small>{m.desc}</small>
					</span>
					{#if stats}<span class="count">{fmt(stats[m.key])}</span>{/if}
					<i class="ri-arrow-right-s-line chev"></i>
				</a>
			{/each}

			<h2>Pengaturan</h2>
			<section
				class="scanner"
				class:on={scanner === 'yes'}
				aria-label="Status scanner"
				style="--tone: {scanner === 'yes' ? 'var(--color-success)' : 'var(--color-neutral)'}"
			>
				<span class="ico"><i class="ri-qr-scan-2-line"></i></span>
				<div class="info">
					<div class="label">Akses Scanner</div>
					<div class="state">
						{#if scanner}
							<span class="dot"></span>{scanner === 'yes' ? 'Aktif' : 'Nonaktif'}
						{:else}
							<span class="sk sm"></span>
						{/if}
					</div>
				</div>
				<button
					type="button"
					class="switch"
					role="switch"
					aria-checked={scanner === 'yes'}
					aria-label="Aktifkan atau nonaktifkan scanner"
					disabled={!scanner || scannerBusy}
					onclick={toggleScanner}
				>
					<span class="knob"></span>
				</button>
			</section>

			{#if scannerError}
				<div class="alert" role="alert">
					<span>{scannerError}</span>
					<button type="button" onclick={loadScanner}>Coba lagi</button>
				</div>
			{/if}
		</nav>
	</main>

	<Footer />
{/if}

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 24px;
		width: min(100% - 32px, 960px);
		margin: 20px auto 48px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
	}

	.head h1 {
		font-size: 1.6rem;
		font-weight: 700;
	}

	.head p {
		margin-top: 4px;
		font-size: 0.95rem;
		color: var(--color-neutral);
	}

	.filter {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.8rem;
		color: var(--color-neutral);
	}

	.filter select {
		min-width: 160px;
		height: 44px;
		padding: 0 40px 0 14px;
		color: var(--color-on-dark);
		background-color: var(--color-surface);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 16px center;
		border: 1px solid var(--color-border);
		border-radius: 12px;
		color-scheme: dark;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
	}

	.filter select:focus-visible {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-border);
	}

	.alert {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		font-size: 0.9rem;
		color: var(--color-danger);
		background: color-mix(in srgb, var(--color-danger) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
		border-radius: 12px;
	}

	.alert button {
		padding: 6px 12px;
		color: var(--color-on-dark);
		background: var(--color-danger);
		border: 0;
		border-radius: 8px;
		cursor: pointer;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
	}

	.scanner {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 20px;
	}

	.scanner .info {
		flex: 1;
		min-width: 0;
	}

	.scanner .info .label {
		font-size: 1.05rem;
		font-weight: 600;
	}

	.scanner .state {
		display: flex;
		align-items: center;
		gap: 10px;
		color: inherit;
		text-decoration: none;
		transition:
			border-color 0.15s ease,
			transform 0.1s ease;
		color: var(--color-neutral);
	}

	.sk.sm {
		width: 70px;
		height: 1.2rem;
	}

	.switch {
		position: relative;
		flex-shrink: 0;
		width: 52px;
		height: 30px;
		padding: 0;
		background: var(--color-border);
		border: 0;
		border-radius: 999px;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.switch[aria-checked='true'] {
		background: var(--color-success);
	}

	.switch .knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 24px;
		height: 24px;
		background: #fff;
		border-radius: 50%;
		transition: transform 0.2s ease;
	}

	.switch[aria-checked='true'] .knob {
		transform: translateX(22px);
	}

	.switch:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.switch:focus-visible {
		outline: 2px solid var(--color-link);
		outline-offset: 2px;
	}

	.stat {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 20px;
		transition: opacity 0.2s ease;
	}

	.stat.dim {
		opacity: 0.55;
	}

	.ico {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 48px;
		height: 48px;
		font-size: 1.5rem;
		color: var(--tone);
		background: color-mix(in srgb, var(--tone) 14%, transparent);
		border-radius: 14px;
	}

	.num {
		margin-top: 2px;
		font-size: 1.9rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.sk {
		display: inline-block;
		width: 90px;
		height: 1.9rem;
		vertical-align: middle;
		background: var(--color-border);
		border-radius: 8px;
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.4;
		}
	}

	.menu {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.menu h2 {
		margin-bottom: 4px;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		color: inherit;
		text-decoration: none;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		transition:
			border-color 0.15s ease,
			transform 0.1s ease;
	}

	.item:hover {
		color: inherit;
		border-color: var(--tone);
	}

	.item:active {
		transform: scale(0.99);
	}

	.item:focus-visible {
		outline: 2px solid var(--color-link);
		outline-offset: 2px;
	}

	.item .txt {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.item small {
		font-size: 0.8rem;
		color: var(--color-neutral);
	}

	.item .count {
		font-weight: 600;
		color: var(--tone);
	}

	.item .chev {
		font-size: 1.4rem;
		color: var(--color-neutral);
	}

	.ws {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		margin-top: -10px;
		gap: 8px;
		padding: 6px 15px;
		font-size: 0.8rem;
		color: var(--color-neutral);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 999px;
	}

	.dot {
		width: 8px;
		height: 8px;
		background: var(--color-danger);
		border-radius: 50%;
		transition: background 0.2s ease;
	}

	.ws.connected .dot,
	.scanner.on .dot {
		background: var(--color-success);
		animation: ping 1.8s ease-out infinite;
	}

	.ws.connecting .dot {
		background: gray;
		animation: ping 1.8s ease-out infinite;
	}

	@keyframes ping {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-success) 55%, transparent);
		}
		70%,
		100% {
			box-shadow: 0 0 0 6px transparent;
		}
	}

	.logs {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.logs h2 {
		font-size: 1.05rem;
		font-weight: 600;
	}

	.table-wrap {
		overflow-x: auto;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		transition: opacity 0.2s ease;
	}

	.table-wrap.dim {
		opacity: 0.55;
	}

	.table-wrap table {
		width: 100%;
		min-width: 520px;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.table-wrap th,
	.table-wrap td {
		padding: 12px 16px;
		text-align: left;
		white-space: nowrap;
	}

	.table-wrap thead th {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-neutral);
		background: color-mix(in srgb, var(--color-bg) 50%, transparent);
		border-bottom: 1px solid var(--color-border);
	}

	.table-wrap tbody tr:not(:last-child) td {
		border-bottom: 1px solid var(--color-border);
	}

	.table-wrap tbody tr:hover td {
		background: color-mix(in srgb, var(--color-on-dark) 3%, transparent);
	}

	.table-wrap .no {
		width: 56px;
		color: var(--color-neutral);
	}

	.table-wrap .mono {
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		color: var(--color-neutral);
	}

	.table-wrap .empty {
		padding: 40px 16px;
		text-align: center;
		color: var(--color-neutral);
	}

	.sk-row {
		display: block;
		height: 18px;
		background: var(--color-border);
		border-radius: 6px;
		animation: pulse 1.2s ease-in-out infinite;
	}

	.badge {
		display: inline-block;
		padding: 3px 10px;
		font-size: 0.78rem;
		font-weight: 600;
		border-radius: 999px;
	}

	.badge.VALID {
		color: var(--color-success);
		background: color-mix(in srgb, var(--color-success) 14%, transparent);
	}

	.badge.ALREADY_SCANNED {
		color: var(--color-warning);
		background: color-mix(in srgb, var(--color-warning) 14%, transparent);
	}

	.badge.NOT_FOUND {
		color: var(--color-danger);
		background: color-mix(in srgb, var(--color-danger) 14%, transparent);
	}

	.pager {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.pinfo {
		font-size: 0.85rem;
		color: var(--color-neutral);
	}

	.pages {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.pages button {
		display: grid;
		place-items: center;
		min-width: 38px;
		height: 38px;
		padding: 0 10px;
		font-size: 0.9rem;
		color: var(--color-on-dark);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.pages button:hover:not(:disabled):not(.active) {
		border-color: var(--color-primary);
	}

	.pages button.active {
		font-weight: 600;
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.pages button:disabled {
		color: var(--color-neutral);
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pages button:focus-visible {
		outline: 2px solid var(--color-link);
		outline-offset: 2px;
	}

	.gap {
		padding: 0 4px;
		color: var(--color-neutral);
	}
</style>
