<script lang="ts">
	import Navbar from '#lib/components/navbar.svelte';
	import Footer from '#lib/components/footer.svelte';
	import Load from '#lib/components/load.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { isLoggedIn, fmtDate } from '#lib/utils/utils.ts';
	import { proxyGet } from '#lib/utils/api.ts';
	import { realtime } from '#lib/utils/realtime.ts';
	import '../../dash.css';
	import { watchStreams, type Scanner, type StreamState } from '#lib/utils/stream.ts';

	type Stats = {
		total: number;
		scanned: number;
		notScanned: number;
		perYear?: { year: number; scanned: number }[];
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
	const LIMIT = 10;
	const RESULT_LABEL = {
		VALID: 'Valid',
		ALREADY_SCANNED: 'Sudah discan',
		NOT_FOUND: 'Tidak ditemukan'
	} as const;
	const DEFAULT_RATIO = 16 / 9;

	let windowLoading = $state(true);
	let stats = $state<Stats | null>(null);
	let years = $state<number[]>([]);
	let year = $state('');
	let loading = $state(true);
	let error = $state('');
	let reqId = 0;
	let wsStatus = $state('connecting');
	let rt: ReturnType<typeof realtime> | undefined;

	let logs = $state<Log[]>([]);
	let logPage = $state(1);
	let logTotal = $state(0);
	let logLoading = $state(true);
	let logError = $state('');
	let logReq = 0;
	let stopped = false;

	let camStatus = $state<StreamState>('connecting');
	let scanners = $state<Scanner[]>([]);
	let images = $state<Record<string, HTMLImageElement | null>>({});
	let states = $state<Record<string, StreamState>>({});
	let ratios = $state<Record<string, number>>({});
	let controller: Awaited<ReturnType<typeof watchStreams>> | undefined;

	const stateOf = (id: string): StreamState => states[id] ?? 'waiting';
	const nameOf = (s: Scanner, i: number) =>
		s.label && s.label !== 'Scanner' ? s.label : `Scanner ${i + 1}`;

	const liveCount = $derived(scanners.filter((s) => stateOf(s.deviceId) === 'live').length);

	const badge = $derived(
		camStatus === 'error'
			? 'Terputus'
			: camStatus === 'connecting'
				? 'Menghubungkan'
				: scanners.length === 0
					? 'Tidak ada scanner'
					: `${liveCount}/${scanners.length} live`
	);

	const emptyMessage = $derived(
		camStatus === 'error'
			? 'Gagal terhubung / tidak punya akses'
			: camStatus === 'connecting'
				? 'Menghubungkan…'
				: 'Belum ada scanner yang online, buka layar scanner di aplikasi.'
	);

	function onImgLoad(id: string) {
		const img = images[id];
		if (!img?.naturalWidth || !img.naturalHeight) return;
		const r = img.naturalWidth / img.naturalHeight;
		if (Math.abs(r - (ratios[id] ?? 0)) > 0.01) ratios[id] = r;
	}

	const logPages = $derived(Math.max(1, Math.ceil(logTotal / LIMIT)));
	const logOffset = $derived((logPage - 1) * LIMIT);
	const logFrom = $derived(logs.length ? logOffset + 1 : 0);
	const logTo = $derived(logs.length ? logOffset + logs.length : 0);

	onMount(() => {
		(async () => {
			const loggedIn = await isLoggedIn(true);
			if (!loggedIn || stopped) return;

			windowLoading = false;
			year = String(new Date().getFullYear());
			void loadStats();
			void loadLogs();

			rt = realtime();
			rt.onStatus((st) => {
				wsStatus = st;
				if (st === 'disconnected') void loadLogs();
			});
			rt.on('ticket:stats', applyStats);
			rt.on('ticket:refreshLogs', () => void loadLogs());

			watchStreams({
				getImage: (id) => images[id],
				onScanners: (list) => (scanners = list),
				onState: (id, s) => {
					if (id) states[id] = s;
					else camStatus = s;
				}
			}).then((c) => {
				if (stopped) c.stop();
				else controller = c;
			});
		})();

		return () => {
			stopped = true;
			controller?.stop();
		};
	});

	onDestroy(() => rt?.close());

	const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);

	function applyStats(s: Stats) {
		void loadLogs();
		if (!s || !Array.isArray(s.perYear)) return;

		years = [...new Set([...years, ...s.perYear.map((p) => p.year)])].sort((a, b) => b - a);

		if (!year) {
			stats = s;
			return;
		}
		const scanned = s.perYear.find((p) => p.year === Number(year))?.scanned ?? 0;
		stats = { total: s.total, scanned, notScanned: s.total - scanned, perYear: s.perYear };
	}

	async function loadStats() {
		const id = ++reqId;
		loading = true;
		error = '';
		try {
			const data = await proxyGet<Stats>({ path: 'tickets', ep: 'stats', year });
			if (id !== reqId) return;
			stats = data;
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
</script>

<svelte:head>
	<title>Live Scan - SMKN 1 Blitar</title>
	<meta name="description" content="PBL Dashboard - SMKN 1 Blitar" />
</svelte:head>

{#if windowLoading}
	<Load />
{:else}
	<Navbar />

	<main class="wrap">
		<a class="back" href="/dashboard"><i class="ri-arrow-left-line"></i> Dashboard</a>

		<div class="container">
			<div class="top">
				<header class="head">
					<div>
						<h1>Live Ticket</h1>
						<p>
							Ringkasan tiket Dies Natalis SMKN 1 Blitar {#if year}
								tahun {year}
							{/if}
						</p>
					</div>
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
						? 'LIVE'
						: wsStatus === 'connecting'
							? 'Menghubungkan...'
							: 'Tidak Terhubung'}
				</span>
			</div>

			<section class="cams-section" aria-label="Live stream kamera scanner">
				<div class="cams-head">
					<header class="head">
						<div>
							<h1>Live Camera</h1>
							<p>Berikut adalah hasil streaming kamera pemindai</p>
						</div>
					</header>
					<span
						class="status"
						class:live={camStatus === 'waiting' && liveCount > 0}
						class:connecting={camStatus === 'connecting'}
					>
						<span class="dot"></span>
						{badge}
					</span>
				</div>

				{#if scanners.length === 0}
					<div class="cams-empty">
						<i class={camStatus === 'error' ? 'ri-wifi-off-line' : 'ri-camera-off-line'}></i>
						<strong>{emptyMessage}</strong>
					</div>
				{/if}

				<div class="cams">
					{#each scanners as s, i (s.deviceId)}
						{@const st = stateOf(s.deviceId)}
						<article class="stream">
							<div class="stream-head">
								<h3>{nameOf(s, i)}</h3>
								<span class="status" class:live={st === 'live'}>
									<span class="dot"></span>
									{st === 'live' ? 'LIVE' : st === 'error' ? 'Gagal' : 'Menunggu'}
								</span>
							</div>

							<div
								class="image-wrap"
								style:--ratio={st === 'live'
									? (ratios[s.deviceId] ?? DEFAULT_RATIO)
									: DEFAULT_RATIO}
							>
								<img
									bind:this={images[s.deviceId]}
									onload={() => onImgLoad(s.deviceId)}
									alt={`Live ${nameOf(s, i)}`}
									class:hidden={st !== 'live'}
								/>
								{#if st !== 'live'}
									<div class="stream-overlay">
										<i class={st === 'error' ? 'ri-error-warning-line' : 'ri-camera-line'}></i>
										<strong>
											{st === 'error'
												? 'Slot penonton scanner ini penuh'
												: `Menunggu gambar dari ${nameOf(s, i)}…`}
										</strong>
									</div>
								{/if}
							</div>
						</article>
					{/each}
				</div>
			</section>
		</div>

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
	</main>

	<Footer />
{/if}

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 24px;
		width: min(100% - 32px, 1200px);
		margin: 20px auto 48px;
	}

	.container {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		align-items: start;
		gap: 20px;
	}

	.top {
		display: flex;
		flex-direction: column;
		gap: 20px;
		min-width: 0;
	}

	.top :global(.stats) {
		grid-template-columns: minmax(0, 1fr);
	}

	.cams-section {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}

	.cams-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.cams-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 40px 24px;
		text-align: center;
		color: var(--color-neutral);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 20px;
	}

	.cams-empty i {
		font-size: 2rem;
		opacity: 0.8;
	}

	.cams-empty strong {
		max-width: 420px;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.cams {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
		align-items: start;
		gap: 16px;
	}

	.stream {
		display: flex;
		flex-direction: column;
		gap: 12px;
		box-sizing: border-box;
		min-width: 0;
		padding: 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 20px;
	}

	.stream-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.stream-head h3 {
		overflow: hidden;
		font-size: 0.95rem;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		font-size: 0.78rem;
		color: var(--color-neutral);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 999px;
		white-space: nowrap;
	}

	.dot {
		width: 8px;
		height: 8px;
		background: var(--color-danger);
		border-radius: 50%;
	}

	.status.live .dot {
		background: var(--color-success);
		animation: ping 1.8s ease-out infinite;
	}

	.status.connecting .dot {
		background: var(--color-warning);
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

	.image-wrap {
		--max-h: min(65svh, 640px);
		position: relative;
		overflow: hidden;
		width: min(100%, calc(var(--max-h) * var(--ratio, 1.7778)));
		aspect-ratio: var(--ratio, 1.7778);
		min-height: 180px;
		margin-inline: auto;
		background: #000;
		border: 1px solid var(--color-border);
		border-radius: 14px;
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	img.hidden {
		display: none;
	}

	.stream-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 20px;
		text-align: center;
		color: #fff;
		background: #000;
	}

	.stream-overlay i {
		font-size: 2rem;
		opacity: 0.8;
	}

	.stream-overlay strong {
		max-width: 320px;
		font-size: 0.85rem;
		font-weight: 500;
	}

	@media (max-width: 900px) {
		.container {
			grid-template-columns: minmax(0, 1fr);
		}

		.top :global(.stats) {
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		}
	}

	@media (max-width: 520px) {
		.top :global(.stats) {
			grid-template-columns: minmax(0, 1fr);
		}

		.wrap {
			gap: 18px;
			width: calc(100% - 32px);
			margin-top: 12px;
		}

		.stream {
			padding: 12px;
			border-radius: 16px;
		}

		.image-wrap {
			border-radius: 12px;
		}

		.logs :global(.pager) {
			justify-content: center;
		}
	}
</style>
