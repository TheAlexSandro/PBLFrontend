<script lang="ts">
	import './global.css';
	import favicon from '#lib/assets/logo.png';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>PBL Smekensa</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
