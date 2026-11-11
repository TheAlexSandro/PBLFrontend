<script lang="ts">
	import Logo from '../assets/logo.png';
	import { onMount } from 'svelte';
	import { isLoggedIn } from '#lib/utils/utils.ts';
	import { proxyPost } from '#lib/utils/api.ts';

	let open = $state(false);
	let root = $state<HTMLElement>();
	let loggedIn = $state<boolean | null>(null);
	let loggingOut = $state(false);

	onMount(async () => {
		try {
			loggedIn = !!(await isLoggedIn());
		} catch {
			loggedIn = false;
		}
	});

	const close = () => {
		if (!loggingOut) open = false;
	};

	function onWindowClick(e: MouseEvent) {
		if (open && root && !root.contains(e.target as Node)) close();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	async function logout() {
		if (loggingOut) return;
		loggingOut = true;
		try {
			await proxyPost({ path: 'auth', ep: 'signOut' }, undefined, { redirectOn401: false });
			window.location.href = '/auth';
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Gagal keluar');
			loggingOut = false;
		}
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<section class="navbar">
	<div class="container nav-inner">
		<img src={Logo} alt="Logo SMKN 1 Blitar" />
		<h1>SMKN 1 Blitar</h1>
	</div>

	<div class="user" bind:this={root}>
		<button
			type="button"
			class="user-btn"
			aria-label="Menu pengguna"
			aria-haspopup="menu"
			aria-expanded={open}
			aria-controls="user-menu"
			disabled={loggedIn === null}
			onclick={() => (open = !open)}
		>
			<i class="ri-user-3-line"></i>
		</button>

		{#if open && loggedIn !== null}
			<div class="dropdown" id="user-menu" role="menu">
				{#if loggedIn}
					<a
						role="menuitem"
						href="/dashboard"
						aria-disabled={loggingOut}
						class:disabled={loggingOut}
						onclick={close}
					>
						<i class="ri-dashboard-line"></i>Dashboard
					</a>
					<button
						type="button"
						role="menuitem"
						class="danger"
						disabled={loggingOut}
						aria-busy={loggingOut}
						onclick={logout}
					>
						<i class={loggingOut ? 'ri-loader-4-line spin' : 'ri-logout-box-r-line'}></i>
						{loggingOut ? 'Keluar...' : 'Keluar'}
					</button>
				{:else}
					<a role="menuitem" href="/auth" onclick={close}>
						<i class="ri-login-box-line"></i>Masuk
					</a>
				{/if}
			</div>
		{/if}
	</div>
</section>

<style>
	.navbar {
		position: sticky;
		top: 0;
		z-index: 10;
		background-color: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding: 0 20px;
	}

	.navbar .nav-inner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding-top: 12px;
		padding-bottom: 12px;
	}

	.navbar .nav-inner img {
		height: 40px;
		width: auto;
	}

	.navbar .nav-inner h1 {
		font-size: 1.125rem;
		font-weight: 600;
		line-height: 1;
	}

	.user {
		position: relative;
	}

	.user-btn {
		padding: 7px;
		border: 0;
		outline: 0;
		background: none;
		color: white;
		cursor: pointer;
		transition: transform 0.1s ease-in-out;
	}

	.user-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.user-btn i {
		font-size: 20px;
	}

	.user-btn:focus-visible {
		outline: 2px solid var(--color-link);
		outline-offset: 2px;
		border-radius: 8px;
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		display: flex;
		flex-direction: column;
		min-width: 200px;
		padding: 6px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
		transform-origin: top right;
		animation: pop 0.12s ease-out;
	}

	.dropdown a,
	.dropdown button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 44px;
		padding: 0 12px;
		background: none;
		border: 0;
		border-radius: 10px;
		color: var(--color-on-dark);
		font-size: 0.95rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.dropdown a:hover,
	.dropdown button:hover {
		color: var(--color-on-dark);
		background: color-mix(in srgb, var(--color-on-dark) 8%, transparent);
	}

	.dropdown .danger,
	.dropdown .danger:hover {
		color: var(--color-danger);
	}

	.dropdown button:disabled,
	.dropdown a.disabled {
		opacity: 0.7;
		cursor: not-allowed;
		pointer-events: none;
	}

	.dropdown i {
		font-size: 18px;
	}

	.dropdown a:focus-visible,
	.dropdown button:focus-visible {
		outline: 2px solid var(--color-link);
		outline-offset: -2px;
	}

	.spin {
		display: inline-block;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
	}

	@media (max-width: 600px) {
		.user {
			position: static;
		}

		.dropdown {
			top: 100%;
			left: 12px;
			right: 12px;
			min-width: 0;
			margin-top: 8px;
			transform-origin: top center;
		}
	}
</style>
