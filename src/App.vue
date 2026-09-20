<template>
	<div class="po-app">
		<header class="po-header">
			<h1 class="po-header__title">Foto OCR</h1>
			<p class="po-header__subtitle">
				Bild hochladen oder mit dem Smartphone fotografieren und den Text bzw.
				die Zahlen per OCR auslesen. Die Verarbeitung findet vollständig in
				deinem Browser statt – die Bilder werden nicht hochgeladen.
			</p>
			<p class="po-header__privacy">
				Bilder werden nicht hochgeladen und nicht gespeichert.
			</p>
		</header>

		<section class="po-card">
			<ImagePicker @select="onSelect" />

			<div v-if="previewUrl" class="po-preview">
				<img :src="previewUrl" alt="Vorschau des ausgewählten Bildes" class="po-preview__image">
				<div class="po-preview__info">
					<span class="po-preview__name">{{ file ? file.name : '' }}</span>
					<span v-if="imageInfo" class="po-preview__size">{{ imageInfo }}</span>
				</div>

				<RotateControls
					:rotation="rotation"
					:disabled="recognizing"
					@rotate="rotate"
					@reset="resetRotation"
				/>
			</div>

			<LanguageSelect v-model="langKey" />

			<div class="po-actions">
				<button
					type="button"
					class="button primary"
					:disabled="!file || recognizing"
					@click="runOcr"
				>
					{{ recognizing ? 'Erkenne Text …' : 'Text erkennen' }}
				</button>
				<button
					v-if="file"
					type="button"
					class="button"
					:disabled="recognizing"
					@click="reset"
				>
					Zurücksetzen
				</button>
			</div>

			<ProgressBar v-if="recognizing" :progress="progress" :status="statusText" />

			<p v-if="error" class="po-message po-message--error">{{ error }}</p>
		</section>

		<section v-if="analysis" class="po-card po-analysis-card">
			<AnalysisCard :analysis="analysis" />
		</section>

		<section class="po-card">
			<ResultBox :text="result" @clear="result = ''" />
		</section>
	</div>
</template>

<script>
import ImagePicker from './components/ImagePicker.vue'
import LanguageSelect from './components/LanguageSelect.vue'
import ProgressBar from './components/ProgressBar.vue'
import ResultBox from './components/ResultBox.vue'
import RotateControls from './components/RotateControls.vue'
import AnalysisCard from './components/AnalysisCard.vue'
import { recognize, terminate } from './ocr.js'
import { renderImage } from './image.js'
import { analyze } from './analysis.js'

const PREVIEW_EDGE = 1200
const OCR_ENHANCE = {
	upscale: 2,
	upscaleCap: 2400,
	downscaleEdge: 1800,
	gray: true,
	contrast: 1.5,
}
const OCR_DEBOUNCE = 500

export default {
	name: 'App',
	components: {
		ImagePicker,
		LanguageSelect,
		ProgressBar,
		ResultBox,
		RotateControls,
		AnalysisCard,
	},
	data() {
		return {
			file: null,
			previewUrl: '',
			imageInfo: '',
			langKey: 'deu+eng',
			rotation: 0,
			previewToken: 0,
			ocrToken: 0,
			ocrTimer: null,
			pendingOcr: false,
			recognizing: false,
			progress: 0,
			statusText: '',
			result: '',
			analysis: null,
			error: '',
		}
	},
	watch: {
		langKey() {
			this.scheduleOcr()
		},
	},
	beforeUnmount() {
		if (this.previewUrl) {
			URL.revokeObjectURL(this.previewUrl)
		}
		if (this.ocrTimer) {
			clearTimeout(this.ocrTimer)
		}
		terminate()
	},
	methods: {
		onSelect(file) {
			this.file = file
			this.rotation = 0
			this.imageInfo = this.formatSize(file.size)
			this.result = ''
			this.error = ''
			this.updatePreview()
			this.runOcr()
		},
		reset() {
			if (this.previewUrl) {
				URL.revokeObjectURL(this.previewUrl)
			}
			if (this.ocrTimer) {
				clearTimeout(this.ocrTimer)
				this.ocrTimer = null
			}
			this.ocrToken += 1
			this.pendingOcr = false
			this.file = null
			this.previewUrl = ''
			this.imageInfo = ''
			this.rotation = 0
			this.result = ''
			this.analysis = null
			this.error = ''
			this.progress = 0
			this.recognizing = false
			this.statusText = ''
		},
		rotate(degrees) {
			let next = ((this.rotation + degrees) % 360 + 360) % 360
			if (next > 180) {
				next -= 360
			}
			this.rotation = next
			this.updatePreview()
			this.scheduleOcr()
		},
		resetRotation() {
			this.rotation = 0
			this.updatePreview()
			this.scheduleOcr()
		},
		scheduleOcr() {
			if (!this.file) {
				return
			}
			if (this.ocrTimer) {
				clearTimeout(this.ocrTimer)
			}
			this.ocrTimer = setTimeout(() => {
				this.ocrTimer = null
				if (this.recognizing) {
					this.pendingOcr = true
					return
				}
				this.runOcr()
			}, OCR_DEBOUNCE)
		},
		async updatePreview() {
			if (!this.file) {
				return
			}
			const token = ++this.previewToken
			const blob = await renderImage(this.file, {
				rotation: this.rotation,
				maxEdge: PREVIEW_EDGE,
			})
			if (token !== this.previewToken) {
				return
			}
			const previousUrl = this.previewUrl
			this.previewUrl = URL.createObjectURL(blob)
			if (previousUrl) {
				URL.revokeObjectURL(previousUrl)
			}
		},
		async runOcr() {
			if (!this.file) {
				return
			}
			if (this.recognizing) {
				this.pendingOcr = true
				return
			}

			const token = ++this.ocrToken
			this.error = ''
			this.result = ''
			this.analysis = null
			this.progress = 0
			this.statusText = 'OCR wird vorbereitet …'
			this.recognizing = true

			try {
				const source = await renderImage(this.file, {
					rotation: this.rotation,
					enhance: OCR_ENHANCE,
				})
				const text = await recognize(source, this.langKey, (message) => {
					if (token !== this.ocrToken) {
						return
					}
					this.statusText = this.statusLabel(message.status)
					if (typeof message.progress === 'number') {
						this.progress = Math.round(message.progress * 100)
					}
				})
				if (token !== this.ocrToken) {
					return
				}
				this.result = (text || '').trim()
				this.analysis = analyze(this.result)
				if (this.result === '') {
					this.error = 'Es wurde kein Text erkannt. Bitte verwende ein schärferes Bild.'
				}
			} catch (error) {
				if (token !== this.ocrToken) {
					return
				}
				this.error = `OCR fehlgeschlagen: ${error && error.message ? error.message : error}`
			} finally {
				if (token === this.ocrToken) {
					this.recognizing = false
					this.statusText = ''
					this.progress = 0
					if (this.pendingOcr) {
						this.pendingOcr = false
						this.scheduleOcr()
					}
				}
			}
		},
		statusLabel(status) {
			const labels = {
				'loading tesseract core': 'Lade OCR-Engine …',
				'initializing tesseract': 'Initialisiere OCR-Engine …',
				'loading language traineddata': 'Lade Sprachdaten …',
				'initializing api': 'Starte Texterkennung …',
				'recognizing text': 'Erkenne Text …',
			}
			return labels[status] || status || 'Verarbeite …'
		},
		formatSize(bytes) {
			if (!bytes) {
				return ''
			}
			if (bytes < 1024) {
				return `${bytes} B`
			}
			if (bytes < 1024 * 1024) {
				return `${(bytes / 1024).toFixed(0)} KB`
			}
			return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
		},
	},
}
</script>

<style>
.po-app {
	max-width: 900px;
	margin: 0 auto;
	padding: 8px 24px 40px;
}

.po-header__title {
	margin: 0 0 4px;
	font-size: 1.6em;
}

.po-header__subtitle {
	margin: 0 0 20px;
	color: var(--color-text-maxcontrast, #767676);
	max-width: 640px;
}

.po-header__privacy {
	margin: -14px 0 20px;
	padding: 6px 12px;
	display: inline-block;
	border-radius: 999px;
	font-size: 0.85em;
	color: var(--color-success-text, #0a7d4b);
	background: rgba(0, 160, 90, 0.12);
}

.po-card {
	margin-bottom: 24px;
	padding: 20px;
	border-radius: var(--border-radius-large, 10px);
	background: var(--color-main-background, #fff);
	border: 1px solid var(--color-border, #ddd);
}

.po-preview {
	margin-top: 16px;
}

.po-preview__image {
	max-width: 100%;
	max-height: 320px;
	border-radius: 8px;
	border: 1px solid var(--color-border, #ddd);
	display: block;
}

.po-preview__info {
	display: flex;
	gap: 12px;
	margin-top: 6px;
	font-size: 0.9em;
	color: var(--color-text-maxcontrast, #767676);
}

.po-preview__name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.po-actions {
	display: flex;
	gap: 12px;
	margin-top: 20px;
}

.po-message {
	margin: 16px 0 0;
	padding: 10px 14px;
	border-radius: 8px;
}

.po-message--error {
	background: var(--color-error-hover, rgba(200, 0, 0, 0.1));
	color: var(--color-error, #c00);
}
</style>
