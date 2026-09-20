<template>
	<div class="po-progress" aria-live="polite">
		<div class="po-progress__track">
			<div class="po-progress__bar" :style="{ width: progress + '%' }"></div>
		</div>
		<p class="po-progress__label">{{ status }} ({{ progress }} %)</p>
	</div>
</template>

<script>
export default {
	name: 'ProgressBar',
	props: {
		progress: {
			type: Number,
			default: 0,
		},
		status: {
			type: String,
			default: '',
		},
	},
}
</script>

<style scoped>
.po-progress {
	margin-top: 16px;
}

.po-progress__track {
	height: 6px;
	width: 100%;
	border-radius: 3px;
	background: var(--color-background-dark, rgba(0, 0, 0, 0.1));
	overflow: hidden;
}

.po-progress__bar {
	height: 100%;
	background: var(--color-primary, #0082c9);
	transition: width 0.2s ease;
}

.po-progress__label {
	margin: 6px 0 0;
	font-size: 0.9em;
	color: var(--color-text-maxcontrast, #767676);
}
</style>
