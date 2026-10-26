<script lang="ts">
	import Logo from '#lib/assets/logo.png';
	import { PUBLIC_API } from '$app/env/public';

	let isLoading = $state(false);
	const getDownloadUrl = async () => {
		isLoading = true;
		const res = await fetch(`${PUBLIC_API}/app/download`);
		if (!res.ok) {
			isLoading = false;
			return alert('Error');
		}
		const resJson = await res.json();

		window.location = resJson.url;
		isLoading = false;
	};
</script>

<svelte:head>
	<title>Unduh Aplikasi Scan Tiket | SMKN 1 Blitar</title>
	<meta name="description" content="Unduh aplikasi scan tiket untuk Android dan iOS." />
</svelte:head>

<main>
	<section class="navbar">
		<div class="container nav-inner">
			<img src={Logo} alt="Logo SMKN 1 Blitar" />
			<h1>SMKN 1 Blitar</h1>
		</div>
	</section>

	<section class="container hero">
		<h2>Unduh Aplikasi Scan Tiket</h2>
		<p>Pilih sesuai perangkat yang Anda gunakan.</p>
	</section>

	<section class="container platforms">
		<article class="card android">
			<div class="card-head">
				<i class="ri-android-line"></i>
				<h3>Android</h3>
			</div>
			<p>Unduh file APK, lalu pasang langsung di HP Anda.</p>
			<ol>
				<li>Tekan tombol <strong>Unduh APK</strong>.</li>
				<li>Buka file hasil unduhan.</li>
				<li>Jika diminta, izinkan pemasangan dari sumber tidak dikenal untuk browser Anda.</li>
			</ol>
			<button class="btn" onclick={getDownloadUrl} disabled={isLoading}
				>{!isLoading ? 'Unduh APK' : 'Mengunduh...'}</button
			>
		</article>
	</section>
</main>

<style>
	.container {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		padding: 0 20px;
	}

	.navbar {
		position: sticky;
		top: 0;
		z-index: 10;
		background-color: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
	}

	.nav-inner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding-top: 12px;
		padding-bottom: 12px;
	}

	.nav-inner img {
		height: 40px;
		width: auto;
	}

	.nav-inner h1 {
		font-size: 1.125rem;
		font-weight: 600;
		line-height: 1;
	}

	.hero {
		padding-top: 48px;
		padding-bottom: 32px;
		text-align: center;
	}

	.hero h2 {
		font-size: clamp(1.5rem, 4vw, 2.25rem);
		font-weight: 700;
	}

	.hero p {
		margin-top: 8px;
		color: var(--color-neutral);
	}

	.platforms {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 20px;
		padding-bottom: 64px;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 24px;
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
	}

	.card-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.card-head h3 {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.android i {
		color: var(--color-success);
	}

	.card i {
		font-size: 25px;
		display: inline-flex;
		line-height: 1.5;
	}

	.card p {
		color: var(--color-neutral);
		line-height: 1.6;
	}

	.card ol {
		padding-left: 20px;
		color: var(--color-neutral);
		line-height: 1.7;
	}

	.card ol strong {
		color: var(--color-on-dark);
		font-weight: 500;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: auto;
		padding: 14px 20px;
		border: none;
		border-radius: 12px;
		background-color: var(--color-primary);
		color: var(--color-on-dark);
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition: filter 0.15s ease;
	}

	.btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn:focus-visible {
		outline: 2px solid var(--color-on-dark);
		outline-offset: 2px;
	}

	.btn:disabled {
		background-color: var(--color-border);
		color: var(--color-neutral);
		cursor: not-allowed;
	}
</style>
