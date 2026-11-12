<script lang="ts">
	import Logo from '../assets/logo.png';
</script>

<div id="splash">
	<img src={Logo} alt="Logo" class="logo" />
	<svg class="spinner" viewBox="25 25 50 50">
		<circle
			class="path"
			cx="50"
			cy="50"
			r="20"
			fill="none"
			stroke-width="4"
			stroke-miterlimit="10"
		/>
	</svg>
</div>

<style>
	#splash {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -60%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #0f1115;
		z-index: 9999;
		transition: opacity 0.3s ease;
	}

	#splash .logo {
		width: min(70vw, 120px);
		height: auto;
		object-fit: contain;
	}

	#splash .spinner {
		margin-top: 40px;
		width: 35px;
		height: 35px;
		animation: rotate 2s linear infinite;
	}

	#splash .spinner .path {
		stroke-dasharray: 1, 200;
		stroke-dashoffset: 0;
		stroke: var(--color-primary);
		stroke-linecap: round;
		animation: dash 1.5s ease-in-out infinite;
	}

	@keyframes rotate {
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes dash {
		0% {
			stroke-dasharray: 1, 200;
			stroke-dashoffset: 0;
		}
		50% {
			stroke-dasharray: 89, 200;
			stroke-dashoffset: -35px;
		}
		100% {
			stroke-dasharray: 89, 200;
			stroke-dashoffset: -124px;
		}
	}
</style>
