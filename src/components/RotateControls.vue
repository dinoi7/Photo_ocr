<template>
	<div class="po-rotate">
		<span class="po-rotate__label">Drehen:</span>

		<button
			type="button"
			class="button"
			:disabled="disabled"
			title="Um 90° nach links drehen"
			@click="$emit('rotate', -90)"
		>
			<svg class="po-rotate__icon po-rotate__icon--left" viewBox="0 0 24 24" aria-hidden="true">
				<path
					fill="currentColor"
					d="M7.11 8.53 5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"
				/>
			</svg>
			90° links
		</button>

		<button
			type="button"
			class="button"
			:disabled="disabled"
			title="Um 90° nach rechts drehen"
			@click="$emit('rotate', 90)"
		>
			<svg class="po-rotate__icon" viewBox="0 0 24 24" aria-hidden="true">
				<path
					fill="currentColor"
					d="M7.11 8.53 5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"
				/>
			</svg>
			90° rechts
		</button>

		<button
			type="button"
			class="button"
			:disabled="disabled"
			title="Um 180° drehen"
			@click="$emit('rotate', 180)"
		>
			180°
		</button>

		<button
			v-if="rotation !== 0"
			type="button"
			class="button"
			:disabled="disabled"
			@click="$emit('reset')"
		>
			Drehung zurücksetzen
		</button>

		<span class="po-rotate__value">{{ rotation }}°</span>
	</div>
</template>

<script>
export default {
	name: 'RotateControls',
	props: {
		rotation: {
			type: Number,
			default: 0,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['rotate', 'reset'],
}
</script>

<style scoped>
.po-rotate {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	margin-top: 12px;
}

.po-rotate__label {
	font-weight: 600;
}

.po-rotate__icon {
	width: 18px;
	height: 18px;
	margin-right: 4px;
	vertical-align: -3px;
}

.po-rotate__icon--left {
	transform: scaleX(-1);
}

.po-rotate__value {
	margin-left: auto;
	font-size: 0.9em;
	color: var(--color-text-maxcontrast, #767676);
}
</style>
