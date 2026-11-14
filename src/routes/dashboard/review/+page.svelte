<script lang="ts">
	import Navbar from '#lib/components/navbar.svelte';
	import Footer from '#lib/components/footer.svelte';
	import Load from '#lib/components/load.svelte';
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { isLoggedIn } from '#lib/utils/utils.ts';
	import { proxyGet, proxyPost } from '#lib/utils/api.ts';

	type Ticket = Record<string, any>;

	const TYPE = 'NOT_SCANNED';
	const LIMITS = [10, 20, 50, 100];

	const q = $derived((page.url.searchParams.get('q') ?? '').trim());
	const pageNum = $derived(Math.max(1, Number(page.url.searchParams.get('page')) || 1));
	const limit = $derived.by(() => {
		const n = Number(page.url.searchParams.get('limit'));
		return LIMITS.includes(n) ? n : 20;
	});

	let windowLoading = $state(true);
	let rows = $state<Ticket[]>([]);
	let total = $state(0);
	let mode = $state<'CLASS' | 'SEARCH' | ''>('');
	let loading = $state(true);
	let error = $state('');
	let reloadKey = $state(0);

	let deletingId = $state<string | null>(null);
	let actionError = $state('');
	let isFinal = $state(true);

	let showFinal = $state(false);
	let finalizing = $state(false);
	let finalError = $state('');
	let cancelBtn = $state<HTMLButtonElement | null>(null);

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

	function openFinal() {
		finalError = '';
		showFinal = true;
	}

	function closeFinal() {
		if (finalizing) return;
		showFinal = false;
	}

	async function confirmFinal() {
		if (finalizing) return;
		finalizing = true;
		finalError = '';
		try {
			await proxyPost({ path: 'admin', ep: 'makeFinal' });
			showFinal = false;
			window.location.reload();
		} catch (e) {
			finalError = e instanceof Error ? e.message : 'Gagal memfinalkan tiket';
		} finally {
			finalizing = false;
		}
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && showFinal) closeFinal();
	}

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

	async function removeTicket(t: Ticket) {
		if (deletingId) return;
		if (!confirm(`Hapus tiket ${t.nama ?? t.id}?`)) return;

		deletingId = String(t.id);
		actionError = '';
		try {
			await proxyPost({ path: 'tickets', ep: 'deleteTicket', id: t.id });
			alert('Tiket berhasil dihapus!\nSilahkan hapus juga yang di spreadsheet jika belum.');
			if (rows.length === 1 && pageNum > 1) go({ page: pageNum - 1 });
			else reloadKey++;
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Gagal menghapus tiket';
		} finally {
			deletingId = null;
		}
	}

	$effect(() => {
		if (showFinal) cancelBtn?.focus();
	});

	$effect(() => {
		const u = q;
		untrack(() => {
			if (u !== cleanQ(qInput)) qInput = u;
		});
	});

	$effect(() => () => clearTimeout(timer));

	$effect(() => {
		if (windowLoading) return;
		if (isFinal) {
			loading = false;
			rows = [];
			total = 0;
			return;
		}
		void reloadKey;

		const ctrl = new AbortController();
		loading = true;
		error = '';

		const params = q
			? { path: 'admin', ep: 'searchTickets', q, page: pageNum, limit }
			: { path: 'admin', ep: 'getTickets', page: pageNum, limit };

		proxyGet<unknown>(params, { signal: ctrl.signal })
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

	async function loadInfo() {
		try {
			const info: any = await proxyGet({ path: 'admin', ep: 'getInfo' });
			isFinal = Boolean(info?.isFinal);
			error = '';
		} catch (e) {
			isFinal = true;
			error = e instanceof Error ? e.message : 'Gagal memuat info';
		}
	}

	async function retry() {
		await loadInfo();
		reloadKey++;
	}

	onMount(async () => {
		const log = await isLoggedIn(true);
		if (!log) return;

		await loadInfo();
		windowLoading = false;
	});
</script>

<svelte:head>
	<title>Tinjau Tiket - PBL Dashboard</title>
	<meta name="description" content="Tinjau Tiket - SMKN 1 Blitar" />
</svelte:head>
<svelte:window onkeydown={onKey} />

{#if windowLoading}
	<Load />
{:else}
	<Navbar />

	<main class="wrap">
		<a class="back" href="/dashboard"><i class="ri-arrow-left-line"></i> Dashboard</a>

		<header class="head">
			<div>
				<h1>Tinjau Tiket</h1>
				<p>{fmt(total)} tiket</p>
				<b style="color: var(--color-danger);"
					>Setelah semua tiket dirasa benar, tekan tombol "finalkan" agar tiket dapat dipindai.</b
				>
			</div>

			<div class="filters">
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

				{#if !isFinal}
					<button type="button" class="btn-final" onclick={openFinal}> FINALKAN </button>
				{:else}
					<span class="final-badge"><i class="ri-lock-line"></i> Sudah final</span>
				{/if}
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

		{#if error}
			<div class="alert" role="alert">
				<span>{error}</span>
				<button type="button" onclick={retry}>Coba lagi</button>
			</div>
		{/if}

		{#if actionError}
			<div class="alert" role="alert">
				<span>{actionError}</span>
				<button type="button" onclick={() => (actionError = '')}>Tutup</button>
			</div>
		{/if}

		<div class="table-wrap" class:dim={loading && rows.length > 0}>
			<table>
				<thead>
					<tr>
						<th>ID tiket</th>
						<th>Nama</th>
						<th>Kelas</th>
						<th class="act">Aksi</th>
					</tr>
				</thead>
				<tbody>
					{#if isFinal}
						<tr>
							<td colspan="4" class="empty">Tidak ada tiket untuk ditinjau</td>
						</tr>
					{:else if loading && !rows.length}
						{#each Array(6) as _}
							<tr>
								<td colspan="4"><span class="sk"></span></td>
							</tr>
						{/each}
					{:else if !rows.length}
						<tr>
							<td colspan="4" class="empty">
								{q ? `Tidak ada tiket untuk "${q}".` : 'Tidak ada tiket terbaru'}
							</td>
						</tr>
					{:else}
						{#each rows as t (t.id)}
							<tr>
								<td class="mono" title={String(t.id ?? '')}>{t.id ?? '-'}</td>
								<td>{t.nama ?? '-'}</td>
								<td>{t.kelas ?? '-'}</td>
								<td class="act">
									<button
										type="button"
										class="del"
										aria-label="Hapus tiket {t.id}"
										title="Hapus"
										disabled={deletingId === String(t.id)}
										onclick={() => removeTicket(t)}
									>
										<i class="ri-delete-bin-line"></i>
									</button>
								</td>
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

	{#if showFinal}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="backdrop"
			role="presentation"
			onclick={(e) => e.target === e.currentTarget && closeFinal()}
		>
			<div class="modal" role="dialog" aria-modal="true" aria-labelledby="final-title">
				<span class="modal-ico"><i class="ri-alert-line"></i></span>
				<h2 id="final-title">Finalkan daftar tiket?</h2>
				<p>Setelah difinalkan:</p>
				<ul>
					<li>TIKET TIDAK AKAN BISA DIHAPUS DAN DIUBAH SELAMANYA.</li>
					<li>Aksi ini <strong>tidak bisa dibatalkan!</strong></li>
				</ul>

				{#if finalError}
					<div class="alert" role="alert"><span>{finalError}</span></div>
				{/if}

				<div class="modal-act">
					<button
						type="button"
						class="btn-cancel"
						bind:this={cancelBtn}
						onclick={closeFinal}
						disabled={finalizing}
					>
						Batal
					</button>
					<button type="button" class="btn-danger" onclick={confirmFinal} disabled={finalizing}>
						{finalizing ? 'Memproses...' : 'Ya, finalkan'}
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 20px;
		width: min(100% - 32px, 960px);
		margin: 20px auto 48px;
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

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
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

	.act {
		width: 64px;
		text-align: right;
	}

	.del {
		display: inline-grid;
		place-items: center;
		width: 34px;
		height: 34px;
		font-size: 1.1rem;
		color: var(--color-danger);
		background: color-mix(in srgb, var(--color-danger) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
		border-radius: 10px;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.del:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-danger) 22%, transparent);
	}

	.del:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.del:focus-visible {
		outline: 2px solid var(--color-link);
		outline-offset: 2px;
	}

	.btn-final,
	.final-badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 16px;
		font-size: 0.9rem;
		font-weight: 600;
		border-radius: 12px;
	}

	.btn-final {
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-final:hover {
		background: color-mix(in srgb, var(--color-primary) 22%, transparent);
	}

	.btn-final:focus-visible {
		outline: 2px solid var(--color-link);
		outline-offset: 2px;
	}

	.final-badge {
		color: var(--color-success);
		background: color-mix(in srgb, var(--color-success) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-success) 35%, transparent);
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 16px;
		background: color-mix(in srgb, #000 65%, transparent);
		backdrop-filter: blur(2px);
	}

	.modal {
		width: min(100%, 420px);
		padding: 24px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 20px;
		box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
	}

	.modal-ico {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		margin-bottom: 14px;
		font-size: 1.5rem;
		color: var(--color-warning);
		background: color-mix(in srgb, var(--color-warning) 14%, transparent);
		border-radius: 14px;
	}

	.modal h2 {
		font-size: 1.2rem;
		font-weight: 700;
	}

	.modal p {
		margin-top: 8px;
		font-size: 0.9rem;
		color: var(--color-neutral);
	}

	.modal ul {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 8px 0 16px 18px;
		font-size: 0.9rem;
		color: var(--color-neutral);
		list-style: disc;
	}

	.modal ul strong {
		color: var(--color-on-dark);
	}

	.modal .alert {
		margin-bottom: 16px;
	}

	.modal-act {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	.modal-act button {
		height: 42px;
		padding: 0 18px;
		font-weight: 600;
		border-radius: 12px;
		cursor: pointer;
	}

	.btn-cancel {
		color: var(--color-on-dark);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
	}

	.btn-danger {
		color: var(--color-on-dark);
		background: var(--color-danger);
		border: 0;
	}

	.modal-act button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.modal-act button:focus-visible {
		outline: 2px solid var(--color-link);
		outline-offset: 2px;
	}
</style>
