<template>
	<div class="po-camera" role="dialog" aria-modal="true" aria-label="Live-Kamera">
		<div class="po-camera__box">
			<div class="po-camera__head">
				<strong>Live-Kamera</strong>
				<button type="button" class="button" @click="$emit('close')">
					Schließen
				</button>
			</div>

			<p v-if="error" class="po-camera__error">{{ error }}</p>

			<video
				ref="video"
				class="po-camera__video"
				:class="{ 'po-camera__video--hidden': !ready }"
				autoplay
				playsinline
				muted
			></video>

			<p v-if="!ready && !error" class="po-camera__hint">Kamera wird gestartet …</p>

			<div class="po-camera__actions">
				<button
					type="button"
					class="button"
					:disabled="!ready"
					@click="switchCamera"
				>
					Kamera wechseln
				</button>
				<button
					type="button"
					class="button primary"
					:disabled="!ready"
					@click="capture"
				>
					Aufnehmen
				</button>
			</div>

			<p class="po-camera__note">
				Das Foto wird nur im Browser verarbeitet und nicht in der Galerie
				gespeichert.
			</p>
		</div>
	</div>
</template>

<script>
const MAX_CAPTURE_EDGE = 1920

export default {
	name: 'CameraCapture',
	emits: ['capture', 'close'],
	data() {
		return {
			stream: null,
			error: '',
			ready: false,
			facingMode: 'environment',
		}
	},
	mounted() {
		this.start()
	},
	beforeUnmount() {
		this.stop()
	},
	methods: {
		async start() {
			this.error = ''
			this.ready = false

			if (!window.isSecureContext) {
				this.error = 'Die Live-Kamera benötigt eine gesicherte Verbindung (HTTPS). Bitte den Kamera-Button (Datei) verwenden.'
				return
			}
			if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
				this.error = 'Dieser Browser unterstützt die Live-Kamera nicht. Bitte den Kamera-Button (Datei) verwenden.'
				return
			}

			this.stop()
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: { ideal: this.facingMode },
						width: { ideal: 1920 },
						height: { ideal: 1080 },
					},
					audio: false,
				})
				this.stream = stream
				const video = this.$refs.video
				if (video) {
					video.srcObject = stream
					await video.play().catch(() => {})
				}
				this.ready = true
			} catch (error) {
				this.error = this.errorMessage(error)
			}
		},
		errorMessage(error) {
			const name = error && error.name
			if (name === 'NotAllowedError' || name === 'SecurityError') {
				return 'Kamera-Zugriff wurde verweigert. Bitte die Berechtigung erteilen oder den Kamera-Button (Datei) verwenden.'
			}
			if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
				return 'Keine Kamera gefunden. Bitte den Kamera-Button (Datei) verwenden.'
			}
			if (name === 'NotReadableError') {
				return 'Die Kamera wird bereits von einer anderen Anwendung verwendet.'
			}
			return `Kamera-Fehler: ${error && error.message ? error.message : error}`
		},
		async switchCamera() {
			this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment'
			await this.start()
		},
		capture() {
			const video = this.$refs.video
			if (!video || !video.videoWidth || !video.videoHeight) {
				return
			}

			const scale = Math.min(1, MAX_CAPTURE_EDGE / Math.max(video.videoWidth, video.videoHeight))
			const canvas = document.createElement('canvas')
			canvas.width = Math.round(video.videoWidth * scale)
			canvas.height = Math.round(video.videoHeight * scale)
			canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)

			canvas.toBlob((blob) => {
				if (!blob) {
					return
				}
				const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' })
				this.stop()
				this.$emit('capture', file)
			}, 'image/jpeg', 0.95)
		},
		stop() {
			if (this.stream) {
				this.stream.getTracks().forEach((track) => track.stop())
				this.stream = null
			}
			const video = this.$refs.video
			if (video) {
				video.srcObject = null
			}
			this.ready = false
		},
	},
}
</script>

<style scoped>
.po-camera {
	position: fixed;
	inset: 0;
	z-index: 10000;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 16px;
	background: rgba(0, 0, 0, 0.6);
}

.po-camera__box {
	width: min(720px, 100%);
	max-height: 100%;
	overflow: auto;
	padding: 16px;
	border-radius: var(--border-radius-large, 12px);
	background: var(--color-main-background, #fff);
}

.po-camera__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 12px;
}

.po-camera__video {
	width: 100%;
	max-height: 60vh;
	border-radius: 10px;
	background: #000;
	display: block;
}

.po-camera__video--hidden {
	display: none;
}

.po-camera__hint,
.po-camera__note {
	margin: 8px 0 0;
	font-size: 0.85em;
	color: var(--color-text-maxcontrast, #767676);
}

.po-camera__error {
	margin: 0 0 12px;
	padding: 10px 14px;
	border-radius: 8px;
	background: var(--color-error-hover, rgba(200, 0, 0, 0.1));
	color: var(--color-error, #c00);
}

.po-camera__actions {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	margin-top: 12px;
}
</style>
