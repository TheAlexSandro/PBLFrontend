<script lang="ts">
	import Navbar from '#lib/components/navbar.svelte';
	import Footer from '#lib/components/footer.svelte';
	import Load from '#lib/components/load.svelte';
	import { onMount } from 'svelte';
	import { isLoggedIn } from '#lib/utils/utils.ts';
	import { proxyPost, ApiError } from '#lib/utils/api.ts';

	let windowLoading = $state(true);
	let showPassword = $state(false);
	let pwd = $state('');
	let usn = $state('');
	let inputError = $state('');
	let isLoading = $state(false);

	onMount(async () => {
		const log = await isLoggedIn();
		if (log) return (window.location.href = '/dashboard');
		windowLoading = false;
	});

	const auth = async (e: Event) => {
		e.preventDefault();
		isLoading = true;
		inputError = '';
		try {
			await proxyPost(
				{ path: 'auth', ep: 'signIn' },
				{ pwd, username: usn },
				{ redirectOn401: false }
			);
			window.location.href = '/dashboard';
		} catch (err) {
			inputError =
				err instanceof ApiError && err.status === 401
					? 'Username atau kata sandi salah'
					: 'Something went wrong...';
			isLoading = false;
		}
	};
</script>

<svelte:head>
	<title>Autentikasi - SMKN 1 Blitar</title>
	<meta name="description" content="Autentikasi - SMKN 1 Blitar" />
</svelte:head>

{#if windowLoading}
	<Load />
{:else}
	<Navbar />

	<section class="container">
		<form class="auth" method="post" onsubmit={auth}>
			<div class="top">
				<h1>Autentikasi</h1>
				<p>Masukkan kredensial untuk mengakses dashboard</p>
			</div>

			<label for="username">Username</label>
			<div class="field">
				<input
					type="text"
					id="username"
					name="username"
					placeholder="username..."
					bind:value={usn}
					required
				/>
			</div>

			<label for="sandi">Kata Sandi</label>
			<div class="field">
				<input
					disabled={isLoading}
					id="sandi"
					name="sandi"
					type={showPassword ? 'text' : 'password'}
					placeholder="••••••••"
					autocomplete="current-password"
					bind:value={pwd}
					required
				/>

				{#if pwd}
					<button disabled={isLoading} type="button" aria-label="rm" onclick={() => (pwd = '')}>
						<i class="ri-close-circle-line"></i>
					</button>
				{/if}
			</div>
			{#if inputError}<div class="error">{inputError}</div>{/if}

			<label class="show">
				<input type="checkbox" bind:checked={showPassword} />
				Tampilkan kata sandi
			</label>

			<button disabled={isLoading} class="btn" type="submit"
				>{!isLoading ? 'Masuk' : 'Memproses...'}</button
			>

			<div class="bot">Kredensial dapat dilihat melalui spreadsheet.</div>
		</form>
	</section>

	<Footer />
{/if}

<style>
	.container {
		min-height: 100dvh;
	}

	.auth {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: min(100% - 32px, 420px);
		margin: 64px auto;
		padding: 28px 24px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 20px;
		color: var(--color-on-dark);
	}

	.auth .top {
		margin-bottom: 16px;
		text-align: center;
	}

	.auth .top h1 {
		margin-bottom: 8px;
		font-size: 1.75rem;
		font-weight: 700;
	}

	.auth .top p {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--color-neutral);
	}

	.auth label {
		font-size: 0.9rem;
		font-weight: 600;
	}

	.auth .field {
		position: relative;
		width: 100%;
		height: 52px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.auth .field:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-border);
	}

	.auth .field input:disabled {
		color: var(--color-neutral);
		opacity: 0.7;
	}

	.auth .field input {
		background: none;
		width: 100%;
		height: 100%;
		padding: 0 16px;
		border-radius: 14px;
		border: 0;
		outline: 0;
		text-align: center;
		color: var(--color-on-dark);
	}

	.auth .field input::placeholder {
		color: var(--color-neutral);
		opacity: 0.7;
	}

	.auth .field button {
		position: absolute;
		top: 0;
		right: 0;
		display: grid;
		place-items: center;
		height: 100%;
		padding: 0 14px;
		background: none;
		border: 0;
		color: var(--color-neutral);
		background: var(--color-bg);
		border-top-right-radius: 14px;
		border-bottom-right-radius: 14px;
		font-size: 1.2rem;
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.auth .field button:disabled {
		opacity: 0.7;
	}

	.auth .field button:disabled:hover {
		opacity: 0.7 !important;
		cursor: not-allowed;
	}

	.auth .error {
		display: inline-block;
		text-align: center;
		color: var(--color-danger);
		font-size: 13px;
		margin: -2px 0;
	}

	.auth .show {
		display: flex;
		align-items: center;
		align-self: flex-start;
		line-height: 1;
		gap: 8px;
		margin-top: 4px;
		font-size: 0.85rem;
		font-weight: 400;
		color: var(--color-neutral);
		cursor: pointer;
		user-select: none;
	}

	.auth .show input {
		appearance: none;
		-webkit-appearance: none;
		display: grid;
		place-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		margin: 0;
		background: transparent;
		border: 1.5px solid var(--color-neutral);
		border-radius: 5px;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.auth .show input::after {
		content: '';
		width: 4px;
		height: 9px;
		margin-top: -2px;
		border: solid var(--color-primary);
		border-width: 0 2px 2px 0;
		transform: rotate(45deg) scale(0);
		transition: transform 0.12s ease;
	}

	.auth .show input:checked {
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.auth .show input:checked::after {
		border-color: var(--color-on-dark);
		transform: rotate(45deg) scale(1);
	}

	.auth .show input:hover {
		border-color: var(--color-link);
	}

	.auth .show input:focus-visible {
		outline: 2px solid var(--color-link);
		outline-offset: 2px;
	}

	.auth .btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 30px;
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

	.auth .btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.auth .btn:focus-visible {
		outline: 2px solid var(--color-on-dark);
		outline-offset: 2px;
	}

	.auth .btn:disabled {
		background-color: var(--color-border);
		color: var(--color-neutral);
		cursor: not-allowed;
	}

	.auth .bot {
		margin-top: 25px;
		font-size: 0.85rem;
		text-align: center;
		color: var(--color-neutral);
	}
</style>
