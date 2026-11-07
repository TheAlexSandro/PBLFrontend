<script lang="ts">
	import Logo from '#lib/assets/logo.png';
	import { PUBLIC_GITHUB, APP_REPO, FRONTEND_REPO, BACKEND_REPO, TICM_REPO } from '$app/env/public';

	let isLoading = $state(false);
	const getDownloadUrl = async (e: Event) => {
		e.preventDefault();
		isLoading = true;
		const res = await fetch(`api/proxy?path=app&ep=download`);
		if (!res.ok) {
			isLoading = false;
			return alert('Error');
		}
		const resJson = await res.json();

		window.location = resJson['result'].url;
		isLoading = false;
	};

	const renderRepo = (type: string) => {
		return `${PUBLIC_GITHUB}/${type === 'APP' ? APP_REPO : type === 'FRONTEND' ? FRONTEND_REPO : type === 'backend' ? BACKEND_REPO : TICM_REPO}`;
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
		<article class="box">
			<div class="box-head">
				<i class="ri-lightbulb-line"></i>
				<h3>Cek Log Perubahan:</h3>
			</div>
			<a href="{renderRepo('APP')}/wiki/Changelog" target="_blank" rel="noopener noreferrer"
				>{renderRepo('APP')}/wiki/Changelog</a
			>
		</article>

		<article class="card android">
			<div class="card-head">
				<i class="ri-android-line" style="color: var(--color-success);"></i>
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

		<article class="card android">
			<div class="card-head">
				<i class="ri-apple-line" style="color: var(--color-primary);"></i>
				<h3>iOS</h3>
			</div>

			<p>Aplikasi belum tersedia untuk iOS.</p>
		</article>

		<div class="hr"></div>

		<article class="card source">
			<div class="card-head">
				<i class="ri-code-s-slash-line"></i>
				<h3>Kode Sumber</h3>
			</div>
			<p>
				Proyek ini bersifat open source dan dapat dikelola oleh siapapun. Kode sumbernya dapat
				dilihat di:
			</p>
			<ol>
				<li>
					Aplikasi Scanner: <a href={renderRepo('APP')} target="_blank" rel="noopener noreferrer"
						>{renderRepo('APP')}</a
					>
				</li>
				<li>
					Frontend (web): <a href={renderRepo('FRONTEND')} target="_blank" rel="noopener noreferrer"
						>{renderRepo('FRONTEND')}</a
					>
				</li>
				<li>
					Backend: <a href={renderRepo('BACKEND')} target="_blank" rel="noopener noreferrer"
						>{renderRepo('BACKEND')}</a
					>
				</li>
				<li>
					Mesin Pembuat Tiket: <a
						href={renderRepo('TICM')}
						target="_blank"
						rel="noopener noreferrer">{renderRepo('TICM')}</a
					>
				</li>
			</ol>
			<p>Anda juga dapat memberikan kontribusi</p>
		</article>
	</section>

	<footer>
		<p>By Alumni SMKN 1 Blitar</p>
	</footer>
</main>

<style>
	ol,
	li,
	p {
		font-size: 14px;
	}

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
		grid-template-columns: 1fr;
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

	.card-head,
	.box-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.card-head h3 {
		font-size: 1.25rem;
		font-weight: 600;
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

	.box {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px 16px;
		background-color: var(--color-primary-soft);
		border: 1px solid var(--color-primary-border);
		border-left: 4px solid var(--color-primary);
		border-radius: 12px;
		font-size: 0.875rem;
	}

	.box-head {
		gap: 8px;
	}

	.box-head h3 {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.box-head i {
		color: var(--color-primary);
		font-size: 20px;
		display: inline-flex;
		line-height: 1;
	}

	.box a {
		overflow-wrap: anywhere;
		line-height: 1.5;
	}

	.source {
		grid-column: 1 / -1;
	}

	.source i {
		color: var(--color-primary);
	}

	.source a {
		overflow-wrap: anywhere;
		line-height: 1.5;
	}

	.hr {
		margin: 10px 20px;
		border-bottom: 1px solid var(--color-neutral);
	}

	footer {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		border-top: 1px solid var(--color-border);
		padding: 12px 0;
		color: var(--color-neutral);
	}
</style>
