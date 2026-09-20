<template>
	<div class="po-analysis">
		<div class="po-analysis__head">
			<span class="po-analysis__badge" :class="`po-analysis__badge--${type}`">
				{{ typeLabel }}
			</span>
			<span class="po-analysis__scores">
				LightBurn {{ analysis.laserScore }} · Bambu {{ analysis.bambuScore }}
			</span>
		</div>

		<div v-if="analysis.laser.time" class="po-analysis__row">
			<span class="po-analysis__label">Laser on time</span>
			<span class="po-analysis__value">{{ analysis.laser.time }}</span>
			<button type="button" class="button" @click="copy('laser', analysis.laser.time)">
				{{ copied === 'laser' ? 'Kopiert' : 'Kopieren' }}
			</button>
		</div>

		<template v-if="analysis.bambu.weight">
			<div class="po-analysis__row">
				<span class="po-analysis__label">Gewicht (OCR)</span>
				<span class="po-analysis__value">{{ weightRawDisplay }}</span>
				<button type="button" class="button" @click="copy('weight', weightRawDisplay)">
					{{ copied === 'weight' ? 'Kopiert' : 'Kopieren' }}
				</button>
			</div>
			<div v-if="weightSuggestionDisplay" class="po-analysis__row po-analysis__row--hint">
				<span class="po-analysis__label">Gewicht (Vorschlag)</span>
				<span class="po-analysis__value">{{ weightSuggestionDisplay }}</span>
				<button type="button" class="button" @click="copy('weight-suggestion', weightSuggestionDisplay)">
					{{ copied === 'weight-suggestion' ? 'Kopiert' : 'Kopieren' }}
				</button>
			</div>
		</template>

		<div v-if="analysis.bambu.material" class="po-analysis__row">
			<span class="po-analysis__label">Material</span>
			<span class="po-analysis__value">{{ analysis.bambu.material }}</span>
			<button type="button" class="button" @click="copy('material', analysis.bambu.material)">
				{{ copied === 'material' ? 'Kopiert' : 'Kopieren' }}
			</button>
		</div>

		<p v-if="!hasValues" class="po-analysis__empty">
			Keine bekannten Werte (LightBurn / Bambu Lab) gefunden.
		</p>

		<p v-if="weightHint" class="po-analysis__note">{{ weightHint }}</p>
	</div>
</template>

<script>
export default {
	name: 'AnalysisCard',
	props: {
		analysis: {
			type: Object,
			required: true,
		},
	},
	data() {
		return {
			copied: null,
		}
	},
	computed: {
		type() {
			return this.analysis.type || 'unknown'
		},
		typeLabel() {
			const labels = {
				laser: 'LightBurn – Laserzeit',
				bambu: 'Bambu Lab – 3D-Druck',
				unknown: 'Unbekanntes Format',
			}
			return labels[this.type] || labels.unknown
		},
		hasValues() {
			return Boolean(
				this.analysis.laser.time
				|| this.analysis.bambu.weight
				|| this.analysis.bambu.material,
			)
		},
		weightRawDisplay() {
			const weight = this.analysis.bambu.weight
			if (!weight) {
				return ''
			}
			return weight.exact ? `${weight.value.toFixed(2)} g` : `${weight.value} g`
		},
		weightSuggestionDisplay() {
			const weight = this.analysis.bambu.weight
			return weight && weight.corrected !== null ? `${weight.corrected.toFixed(2)} g` : ''
		},
		weightHint() {
			const weight = this.analysis.bambu.weight
			if (weight && weight.corrected !== null) {
				return 'Der Dezimalpunkt wurde von der OCR nicht erkannt. Der Vorschlag ist eine Interpretation der Ziffernfolge.'
			}
			return ''
		},
	},
	methods: {
		async copy(key, value) {
			try {
				await navigator.clipboard.writeText(value)
				this.copied = key
				setTimeout(() => {
					if (this.copied === key) {
						this.copied = null
					}
				}, 1500)
			} catch (error) {
				this.copied = null
			}
		},
	},
}
</script>

<style scoped>
.po-analysis__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	flex-wrap: wrap;
	margin-bottom: 12px;
}

.po-analysis__badge {
	display: inline-block;
	padding: 3px 10px;
	border-radius: 999px;
	font-size: 0.85em;
	font-weight: 600;
	background: var(--color-primary-light, rgba(0, 130, 201, 0.15));
	color: var(--color-primary-text, #00679e);
}

.po-analysis__badge--bambu {
	background: rgba(0, 160, 90, 0.15);
	color: #0a7d4b;
}

.po-analysis__badge--unknown {
	background: var(--color-background-dark, rgba(0, 0, 0, 0.08));
	color: var(--color-text-maxcontrast, #767676);
}

.po-analysis__scores {
	font-size: 0.8em;
	color: var(--color-text-maxcontrast, #767676);
}

.po-analysis__row {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px 0;
	border-top: 1px solid var(--color-border, #ddd);
	flex-wrap: wrap;
}

.po-analysis__row--hint {
	background: var(--color-warning-hover, rgba(255, 200, 0, 0.12));
	border-radius: 8px;
	padding-inline: 8px;
}

.po-analysis__label {
	min-width: 150px;
	color: var(--color-text-maxcontrast, #767676);
}

.po-analysis__value {
	font-family: var(--font-face-monospace, monospace);
	font-size: 1.15em;
	font-weight: 600;
	margin-right: auto;
}

.po-analysis__empty {
	margin: 8px 0 0;
	color: var(--color-text-maxcontrast, #767676);
}

.po-analysis__note {
	margin: 8px 0 0;
	font-size: 0.85em;
	color: var(--color-text-maxcontrast, #767676);
}
</style>
