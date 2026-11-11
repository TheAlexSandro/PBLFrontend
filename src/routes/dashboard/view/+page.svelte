<script lang="ts">
	import Navbar from '#lib/components/navbar.svelte';
	import Footer from '#lib/components/footer.svelte';
	import Load from '#lib/components/load.svelte';
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { isLoggedIn } from '#lib/utils/utils.ts';
	import { proxyGet } from '#lib/utils/api.ts';

	type TicketType = 'SCANNED' | 'NOT_SCANNED' | 'TOTAL';
	type Ticket = Record<string, any>;

	const TYPES: Record<TicketType, { title: string; tab: string }> = {
		SCANNED: { title: 'Tiket terpindai', tab: 'Terpindai' },
		NOT_SCANNED: { title: 'Tiket tidak terpindai', tab: 'Tidak terpindai' },
		TOTAL: { title: 'Tiket keseluruhan', tab: 'Keseluruhan' }
	};
	const LIMITS = [10, 20, 50, 100];
	const thisYear = new Date().getFullYear();

	const type = $derived.by<TicketType>(() => {
		const t = (page.url.searchParams.get('type') ?? '').toUpperCase();
		return t in TYPES ? (t as TicketType) : 'TOTAL';
	});
	const year = $derived(page.url.searchParams.get('year') ?? '');
	const q = $derived((page.url.searchParams.get('q') ?? '').trim());
	const pageNum = $derived(Math.max(1, Number(page.url.searchParams.get('page')) || 1));
	const limit = $derived.by(() => {
		const n = Number(page.url.searchParams.get('limit'));
		return LIMITS.includes(n) ? n : 20;
	});
	const yearLabel = $derived(q ? year || String(thisYear) : year);

	let windowLoading = $state(true);
	let years = $state<number[]>([]);
	let rows = $state<Ticket[]>([]);
	let total = $state(0);
	let mode = $state<'CLASS' | 'SEARCH' | ''>('');
	let loading = $state(true);
	let error = $state('');

	let qInput = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout>;

	const offset = $derived(mode === 'CLASS' ? 0 : (pageNum - 1) * limit);
	const totalPages = $derived(mode === 'CLASS' ? 1 : Math.max(1, Math.ceil(total / limit)));
	const from = $derived(rows.length ? offset + 1 : 0);
	const to = $derived(rows.length ? offset + rows.length : 0);

	const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);

	function go(next: Record<string, string | number | null>) {
		const q = new URLSearchParams(page.url.searchParams.toString());
		for (const [k, v] of Object.entries(next)) {
			if (v === null || v === '') q.delete(k);
			else q.set(k, String(v));
		}
		void goto(`?${q}`, { reset: false });
	}

	const cleanQ = (s: string) => s.trim().replace(/\s+/g, ' ');

	function applySearch() {
		clearTimeout(timer);
		const v = cleanQ(qInput);
		if (v === q) return;
		go({ q: v, page: 1 });
	}

	function onSearchInput() {
		clearTimeout(timer);
		timer = setTimeout(applySearch, 350);
	}

	function clearSearch() {
		qInput = '';
		applySearch();
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

	function normalize(r: any): { items: Ticket[]; total: number; mode: 'CLASS' | 'SEARCH' | '' } {
		const items: Ticket[] = Array.isArray(r) ? r : (r?.data ?? r?.items ?? r?.tickets ?? []);
		const total = Number(r?.total ?? r?.meta?.total ?? r?.pagination?.total ?? items.length);
		const mode = r?.mode === 'CLASS' || r?.mode === 'SEARCH' ? r.mode : '';
		return { items, total, mode };
	}

	const isScanned = (t: Ticket) => Boolean(t.scannedAt ?? t.scanned_at ?? t.isScanned ?? t.scanned);
	const fmtDate = (v: unknown) => {
		const d = new Date(String(v ?? ''));
		return Number.isNaN(d.getTime())
			? '-'
			: d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
	};

	$effect(() => {
		const u = q;
		untrack(() => {
			if (u !== cleanQ(qInput)) qInput = u;
		});
	});

	$effect(() => () => clearTimeout(timer));

	$effect(() => {
		if (windowLoading) return;

		const ctrl = new AbortController();
		loading = true;
		error = '';

		const params = q
			? { path: 'admin', ep: 'searchTickets', q, type, year, page: pageNum, limit }
			: { path: 'admin', ep: 'getTickets', type, year, page: pageNum, limit };

		proxyGet<unknown>(params, ctrl.signal)
			.then((r) => {
				const n = normalize(r);
				rows = n.items;
				total = n.total;
				mode = n.mode;
			})
			.catch((e) => {
				if (ctrl.signal.aborted) return;
				error = e instanceof Error ? e.message : 'Gagal memuat data';
			})
			.finally(() => {
				if (!ctrl.signal.aborted) loading = false;
			});

		return () => ctrl.abort();
	});

	onMount(async () => {
		const log = await isLoggedIn();
		if (!log) return (window.location.href = '/auth');
		windowLoading = false;

		try {
			const s = await proxyGet<{ perYear: { year: number }[] }>({ path: 'tickets', ep: 'stats' });
			years = s.perYear.map((p) => p.year).sort((a, b) => b - a);
		} catch {}
	});
</script>

<svelte:head>
	<title>{TYPES[type].title} - PBL Dashboard</title>
	<meta name="description" content="{TYPES[type].title} - SMKN 1 Blitar" />
</svelte:head>

{#if windowLoading}
	<Load />
{:else}
	<Navbar />

	<main class="wrap">
		<a class="back" href="/dashboard"><i class="ri-arrow-left-line"></i> Dashboard</a>

		<header class="head">
			<div>
				<h1>{TYPES[type].title}</h1>
				<p>{fmt(total)} tiket{yearLabel ? ` • tahun ${yearLabel}` : ''}</p>
			</div>

			<div class="filters">
				<label class="filter">
					Tahun
					<select value={year} onchange={(e) => go({ year: e.currentTarget.value, page: 1 })}>
						<option value="">Semua tahun</option>
						{#each years as y}
							<option value={String(y)}>{y}</option>
						{/each}
					</select>
				</label>

				<label class="filter">
					Per halaman
					<select
						value={String(limit)}
						onchange={(e) => go({ limit: e.currentTarget.value, page: 1 })}
					>
						{#each LIMITS as l}
							<option value={String(l)}>{l}</option>
						{/each}
					</select>
				</label>
			</div>
		</header>

		<form
			class="search"
			role="search"
			onsubmit={(e) => {
				e.preventDefault();
				applySearch();
			}}
		>
			<i class="ri-search-line lead"></i>
			<input
				type="search"
				bind:value={qInput}
				oninput={onSearchInput}
				placeholder="Cari nama, kelas, atau ID tiket"
				aria-label="Cari tiket"
				maxlength="100"
				autocomplete="off"
				enterkeyhint="search"
			/>
			{#if qInput}
				<button type="button" class="clear" aria-label="Hapus pencarian" onclick={clearSearch}>
					<i class="ri-close-circle-line"></i>
				</button>
			{/if}
		</form>

		{#if mode === 'CLASS' && q}
			<div class="note">
				<i class="ri-group-line"></i>
				<span>Menampilkan semua siswa kelas <strong>{q}</strong></span>
			</div>
		{/if}

		<div class="tabs" role="tablist">
			{#each Object.entries(TYPES) as [key, m]}
				<button
					type="button"
					role="tab"
					aria-selected={type === key}
					class:active={type === key}
					onclick={() => go({ type: key, page: 1 })}
				>
					{m.tab}
				</button>
			{/each}
		</div>

		{#if error}
			<div class="alert" role="alert">
				<span>{error}</span>
				<button type="button" onclick={() => go({ page: pageNum })}>Coba lagi</button>
			</div>
		{/if}

		<div class="table-wrap" class:dim={loading && rows.length > 0}>
			<table>
				<thead>
					<tr>
						<th class="no">No</th>
						<th>ID tiket</th>
						<th>Nama</th>
						<th>Kelas</th>
						<th>Status</th>
						<th>Waktu scan</th>
					</tr>
				</thead>
				<tbody>
					{#if loading && !rows.length}
						{#each Array(6) as _}
							<tr>
								<td colspan="6"><span class="sk"></span></td>
							</tr>
						{/each}
					{:else if !rows.length}
						<tr>
							<td colspan="6" class="empty">
								{q ? `Tidak ada tiket untuk "${q}".` : 'Tidak ada tiket.'}
							</td>
						</tr>
					{:else}
						{#each rows as t, i}
							<tr>
								<td class="no">{offset + i + 1}</td>
								<td class="mono" title={String(t.id ?? '')}>{t.id ?? '-'}</td>
								<td>{t.nama ?? '-'}</td>
								<td>{t.kelas ?? '-'}</td>
								<td>
									{#if isScanned(t)}
										<span class="badge ok">Terpindai</span>
									{:else}
										<span class="badge no">Belum</span>
									{/if}
								</td>
								<td>{isScanned(t) ? fmtDate(t.scannedAt ?? t.scanned_at) : '-'}</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>

		<footer class="pager">
			<span class="info">Menampilkan {fmt(from)}–{fmt(to)} dari {fmt(total)}</span>

			<div class="pages">
				<button
					type="button"
					aria-label="Halaman sebelumnya"
					disabled={pageNum <= 1}
					onclick={() => go({ page: pageNum - 1 })}
				>
					<i class="ri-arrow-left-s-line"></i>
				</button>

				{#each pageList(pageNum, totalPages) as p}
					{#if p === '…'}
						<span class="gap">…</span>
					{:else}
						<button
							type="button"
							class:active={p === pageNum}
							aria-current={p === pageNum ? 'page' : undefined}
							onclick={() => go({ page: p })}
						>
							{p}
						</button>
					{/if}
				{/each}

				<button
					type="button"
					aria-label="Halaman berikutnya"
					disabled={pageNum >= totalPages}
					onclick={() => go({ page: pageNum + 1 })}
				>
					<i class="ri-arrow-right-s-line"></i>
				</button>
			</div>
		</footer>
	</main>

	<Footer />
{/if}

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 20px;
		width: min(100% - 32px, 960px);
		margin: 32px auto 48px;
	}

	.back {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9rem;
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

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.filter {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.8rem;
		color: var(--color-neutral);
	}

	.filter select {
		min-width: 140px;
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

	.search {
		position: relative;
		display: flex;
		align-items: center;
		height: 48px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.search:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-border);
	}

	.search .lead {
		padding-left: 14px;
		font-size: 1.1rem;
		color: var(--color-neutral);
	}

	.search input {
		flex: 1;
		min-width: 0;
		height: 100%;
		padding: 0 12px;
		color: var(--color-on-dark);
		background: none;
		border: 0;
		outline: 0;
	}

	.search input::placeholder {
		color: var(--color-neutral);
		opacity: 0.7;
	}

	.search input::-webkit-search-cancel-button {
		display: none;
	}

	.search .clear {
		display: grid;
		place-items: center;
		height: 100%;
		padding: 0 14px;
		font-size: 1.2rem;
		color: var(--color-neutral);
		background: none;
		border: 0;
		cursor: pointer;
	}

	.note {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: -8px;
		font-size: 0.85rem;
		color: var(--color-neutral);
	}

	.mono {
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		color: var(--color-neutral);
	}

	.tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		overflow-x: auto;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 14px;
	}

	.tabs button {
		flex: 1;
		padding: 10px 14px;
		font-weight: 600;
		white-space: nowrap;
		color: var(--color-neutral);
		background: none;
		border: 0;
		border-radius: 10px;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.tabs button:hover {
		color: var(--color-on-dark);
	}

	.tabs button.active {
		color: var(--color-on-dark);
		background: var(--color-primary);
	}

	.tabs button:focus-visible {
		outline: 2px solid var(--color-link);
		outline-offset: 2px;
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

	table {
		width: 100%;
		min-width: 560px;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		padding: 12px 16px;
		text-align: left;
		white-space: nowrap;
	}

	thead th {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-neutral);
		background: color-mix(in srgb, var(--color-bg) 50%, transparent);
		border-bottom: 1px solid var(--color-border);
	}

	tbody tr:not(:last-child) td {
		border-bottom: 1px solid var(--color-border);
	}

	tbody tr:hover td {
		background: color-mix(in srgb, var(--color-on-dark) 3%, transparent);
	}

	.no {
		width: 56px;
		color: var(--color-neutral);
	}

	.empty {
		padding: 40px 16px;
		text-align: center;
		color: var(--color-neutral);
	}

	.sk {
		display: block;
		height: 18px;
		background: var(--color-border);
		border-radius: 6px;
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.4;
		}
	}

	.badge {
		display: inline-block;
		padding: 3px 10px;
		font-size: 0.78rem;
		font-weight: 600;
		border-radius: 999px;
	}

	.badge.ok {
		color: var(--color-success);
		background: color-mix(in srgb, var(--color-success) 14%, transparent);
	}

	.badge.no {
		color: var(--color-warning);
		background: color-mix(in srgb, var(--color-warning) 14%, transparent);
	}

	.pager {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.info {
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
