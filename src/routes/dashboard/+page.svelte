<script lang="ts">
	import Navbar from '#lib/components/navbar.svelte';
	import Footer from '#lib/components/footer.svelte';
	import Load from '#lib/components/load.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { isLoggedIn } from '#lib/utils/utils.ts';
	import { proxyGet, proxyPost } from '#lib/utils/api.ts';
	import { realtime } from '#lib/utils/realtime.ts';
	import '../dash.css';

	type Stats = {
		total: number;
		scanned: number;
		notScanned: number;
		perYear?: { year: number; scanned: number }[];
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
			title: 'Tiket Belum Dipindai',
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

	const reviewMenus = [
		{
			title: 'Tinjau Tiket',
			desc: 'Tinjau tiket dan finalkan agar tiket dapat digunakan',
			icon: 'ri-file-edit-line',
			tone: 'var(--color-danger)',
			url: '/dashboard/review'
		},
		{
			title: 'Live Scan',
			desc: 'Lihat statistik tiket tahun ini dan tayangan kamera pemindai langsung',
			icon: 'ri-video-on-line',
			tone: '#7F00FF',
			url: '/dashboard/stream'
		}
	] as const;

	let windowLoading = $state(true);
	let stats = $state<Stats | null>(null);
	let years = $state<number[]>([]);
	let year = $state('');
	let loading = $state(true);
	let error = $state('');
	let reqId = 0;
	let scanner = $state(null);
	let scannerBusy = $state(false);
	let scannerError = $state('');
	let rt: ReturnType<typeof realtime> | undefined;

	onMount(async () => {
		const log = await isLoggedIn(true);
		if (!log) return;
		windowLoading = false;
		void loadStats();
		void loadYears();
		void loadScanner();

		rt = realtime();
		rt.on('scanner:status', (r) => {
			scanner = r['active'];
		});
	});

	onDestroy(() => rt?.close());

	const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
	const viewHref = (type: string) => `/dashboard/view?type=${type}${year ? `&year=${year}` : ''}`;

	async function loadScanner() {
		try {
			const st = await proxyGet({ path: 'tickets', ep: 'scannerStatus' });
			// menggunakan yes dan no karena hasilnya true/false
			scanner = (st as any)['isScannerReady'];
			scannerError = '';
		} catch (e) {
			scannerError = e instanceof Error ? e.message : 'Gagal memuat status scanner';
		}
	}

	async function toggleScanner() {
		if (scanner === null || scannerBusy) return;
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

	async function loadYears() {
		const current = new Date().getFullYear();
		try {
			const all = await proxyGet<Stats>({ path: 'tickets', ep: 'stats' });
			const fromApi = (all?.perYear ?? []).map((p) => p.year);
			// tahun berjalan selalu ada di pilihan, walau belum ada tiket yang discan
			years = [...new Set([current, ...fromApi])].sort((a, b) => b - a);
		} catch {
			years = [current];
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

		<nav class="menu" aria-label="menu">
			<h2>Aksi</h2>
			{#each reviewMenus as m}
				<a class="item" href={m.url} style="--tone: {m.tone}">
					<span class="ico"><i class={m.icon}></i></span>
					<span class="txt">
						<strong>{m.title}</strong>
						<small>{m.desc}</small>
					</span>
					<i class="ri-arrow-right-s-line chev"></i>
				</a>
			{/each}

			<h2>Daftar Tiket</h2>
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
				class:on={scanner === true}
				aria-label="Status scanner"
				style="--tone: {scanner === true ? 'var(--color-success)' : 'var(--color-neutral)'}"
			>
				<span class="ico"><i class="ri-qr-scan-2-line"></i></span>
				<div class="info">
					<div class="label">Akses Scanner</div>
					<div class="state">
						{#if scanner !== null}
							<span class="dot"></span>{scanner === true ? 'Aktif' : 'Nonaktif'}
						{:else}
							<span class="sk sm"></span>
						{/if}
					</div>
				</div>
				<button
					type="button"
					class="switch"
					role="switch"
					aria-checked={scanner === true}
					aria-label="Aktifkan atau nonaktifkan scanner"
					disabled={scanner === null || scannerBusy}
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
