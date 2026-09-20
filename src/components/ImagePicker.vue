<template>
	<div class="po-picker">
		<div
			class="po-dropzone"
			:class="{ 'po-dropzone--active': dragging }"
			role="button"
			tabindex="0"
			@click="openUpload"
			@keydown.enter.prevent="openUpload"
			@keydown.space.prevent="openUpload"
			@dragover.prevent="dragging = true"
			@dragleave.prevent="dragging = false"
			@drop.prevent="onDrop"
		>
			<svg class="po-dropzone__icon" viewBox="0 0 24 24" aria-hidden="true">
				<path
					fill="currentColor"
					d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.48 7.48 0 0 0-6.64 4.04A5.994 5.994 0 0 0 6 20h13a4.99 4.99 0 0 0 .35-9.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"
				/>
			</svg>
			<p class="po-dropzone__title">Bild hierher ziehen oder klicken zum Auswählen</p>
			<p class="po-dropzone__hint">PNG, JPEG, WebP, BMP oder TIFF</p>
		</div>

		<div class="po-picker__buttons">
			<button type="button" class="button po-picker__camera" @click="openCamera">
				<svg class="po-button__icon" viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="currentColor"
						d="M9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
					/>
				</svg>
				Foto mit dem Smartphone aufnehmen
			</button>

			<button type="button" class="button po-picker__camera" @click="liveCamera = true">
				<svg class="po-button__icon" viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="currentColor"
						d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"
					/>
				</svg>
				Live-Kamera (ohne Galerie)
			</button>
		</div>

		<CameraCapture
			v-if="liveCamera"
			@capture="onCapture"
			@close="liveCamera = false"
		/>

		<input
			ref="uploadInput"
			class="po-hidden"
			type="file"
			accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
			@change="onChange"
		>
		<input
			ref="cameraInput"
			class="po-hidden"
			type="file"
			accept="image/*"
			capture="environment"
			@change="onChange"
		>
	</div>
</template>

<script>
import CameraCapture from './CameraCapture.vue'

export default {
	name: 'ImagePicker',
	components: {
		CameraCapture,
	},
	emits: ['select'],
	data() {
		return {
			dragging: false,
			liveCamera: false,
		}
	},
	methods: {
		openUpload() {
			this.$refs.uploadInput.click()
		},
		openCamera() {
			this.$refs.cameraInput.click()
		},
		onCapture(file) {
			this.liveCamera = false
			this.$emit('select', file)
		},
		onChange(event) {
			const file = event.target.files && event.target.files[0]
			if (file) {
				this.$emit('select', file)
			}
			event.target.value = ''
		},
		onDrop(event) {
			this.dragging = false
			const file = event.dataTransfer.files && event.dataTransfer.files[0]
			if (file && file.type.startsWith('image/')) {
				this.$emit('select', file)
			}
		},
	},
}
</script>

<style scoped>
.po-dropzone {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	padding: 32px 16px;
	border: 2px dashed var(--color-border-dark, #999);
	border-radius: var(--border-radius-large, 10px);
	background: var(--color-background-dark, rgba(0, 0, 0, 0.04));
	cursor: pointer;
	text-align: center;
	transition: border-color 0.15s ease, background-color 0.15s ease;
}

.po-dropzone:hover,
.po-dropzone:focus-visible,
.po-dropzone--active {
	border-color: var(--color-primary, #0082c9);
	background: var(--color-primary-light, rgba(0, 130, 201, 0.08));
	outline: none;
}

.po-dropzone__icon {
	width: 48px;
	height: 48px;
	color: var(--color-primary, #0082c9);
}

.po-dropzone__title {
	margin: 4px 0 0;
	font-weight: 600;
}

.po-dropzone__hint {
	margin: 0;
	color: var(--color-text-maxcontrast, #767676);
	font-size: 0.9em;
}

.po-picker__buttons {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	margin-top: 12px;
}

.po-picker__camera {
	display: inline-flex;
	align-items: center;
	gap: 8px;
}

.po-button__icon {
	width: 20px;
	height: 20px;
}

.po-hidden {
	position: absolute;
	width: 1px;
	height: 1px;
	opacity: 0;
	pointer-events: none;
}
</style>
