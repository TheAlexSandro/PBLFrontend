<script lang="ts">
	import { onMount } from 'svelte';
	let year = $state();

	onMount(() => {
		year = new Date().getFullYear();
	});
</script>

<footer>
	<p>Copyright &copy; {year} By Alumni SMKN 1 Blitar</p>
</footer>

<style>
	footer {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		border-top: 1px solid var(--color-border);
		padding: 17px 0;
		font-size: 14px;
		color: var(--color-neutral);
	}
</style>
