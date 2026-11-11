<script lang="ts">
	import Navbar from '#lib/components/navbar.svelte';
	import Footer from '#lib/components/footer.svelte';
	import Load from '#lib/components/load.svelte';
	import { onMount } from 'svelte';
	import { isLoggedIn } from '#lib/utils/utils.ts';
	import { proxyGet, proxyPost } from '#lib/utils/api.ts';

	type Stats = {
		total: number;
		scanned: number;
		notScanned: number;
		thisYear: number;
		perYear: { year: number; scanned: number }[];
	};

	const cards = [
		{
			key: 'scanned',
			label: 'Tiket terpindai',
			icon: 'ri-checkbox-circle-line',
			tone: 'var(--color-success)'
		},
		{
			key: 'notScanned',
			label: 'Belum terpindai',
			icon: 'ri-time-line',
			tone: 'var(--color-warning)'
		},
		{ key: 'total', label: 'Total tiket', icon: 'ri-ticket-2-line', tone: 'var(--color-primary)' }
	] as const;

	const menus = [
		{
			type: 'SCANNED',
			key: 'scanned',
			title: 'Tiket terpindai',
			desc: 'Tiket yang sudah discan',
			icon: 'ri-checkbox-circle-line',
			tone: 'var(--color-success)'
		},
		{
			type: 'NOT_SCANNED',
			key: 'notScanned',
			title: 'Tiket tidak terpindai',
			desc: 'Tiket yang belum discan',
			icon: 'ri-time-line',
			tone: 'var(--color-warning)'
		},
		{
			type: 'TOTAL',
			key: 'total',
			title: 'Tiket keseluruhan',
			desc: 'Semua tiket yang terdaftar',
			icon: 'ri-ticket-2-line',
			tone: 'var(--color-primary)'
		}
	] as const;

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

	const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
	const viewHref = (type: string) => `/dashboard/view?type=${type}${year ? `&year=${year}` : ''}`;

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

	function onYearChange(e: Event & { currentTarget: HTMLSelectElement }) {
		year = e.currentTarget.value;
		void loadStats();
	}

	onMount(async () => {
		const log = await isLoggedIn();
		if (!log) return (window.location.href = '/auth');
		windowLoading = false;
		void loadStats();
		void loadScanner();
	});
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
				<p>Ringkasan tiket Dies Natalis SMKN 1 Blitar tahun {stats?.thisYear}</p>
			</div>

			<label class="filter">
				Tahun
				<select value={year} onchange={onYearChange}>
					<option value="">Pilih tahun</option>
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

		<nav class="menu" aria-label="Daftar tiket">
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
		</nav>

		<nav class="menu" aria-label="Daftar tiket">
			<h2>Pengaturan</h2>
			<section
				class="scanner"
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
		margin: 32px auto 48px;
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
		padding: 0 12px;
		color: var(--color-on-dark);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		color-scheme: dark;
		cursor: pointer;
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

	.scanner .state {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 2px;
		font-size: 1.2rem;
		font-weight: 700;
		line-height: 1.6;
	}

	.scanner .dot {
		width: 10px;
		height: 10px;
		background: var(--tone);
		border-radius: 50%;
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

	.label {
		font-size: 0.85rem;
		color: var(--color-neutral);
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
</style>
