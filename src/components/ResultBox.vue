<template>
	<div class="po-result">
		<div class="po-result__header">
			<h2 class="po-result__title">Erkannter Text</h2>
			<div class="po-result__actions">
				<button type="button" class="button" :disabled="!text" @click="copy">
					{{ copied ? 'Kopiert' : 'Kopieren' }}
				</button>
				<button type="button" class="button" :disabled="!text" @click="$emit('clear')">
					Leeren
				</button>
			</div>
		</div>

		<textarea
			class="po-result__text"
			:value="text"
			readonly
			rows="14"
			placeholder="Noch kein Text erkannt."
		></textarea>

		<p class="po-result__meta">{{ characterCount }} Zeichen · {{ wordCount }} Wörter</p>
	</div>
</template>

<script>
export default {
	name: 'ResultBox',
	props: {
		text: {
			type: String,
			default: '',
		},
	},
	emits: ['clear'],
	data() {
		return {
			copied: false,
		}
	},
	computed: {
		characterCount() {
			return this.text.length
		},
		wordCount() {
			const trimmed = this.text.trim()
			return trimmed === '' ? 0 : trimmed.split(/\s+/).length
		},
	},
	methods: {
		async copy() {
			try {
				await navigator.clipboard.writeText(this.text)
				this.copied = true
				setTimeout(() => {
					this.copied = false
				}, 1500)
			} catch (error) {
				const area = this.$el.querySelector('textarea')
				if (area) {
					area.focus()
					area.select()
				}
			}
		},
	},
}
</script>

<style scoped>
.po-result__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	flex-wrap: wrap;
}

.po-result__title {
	margin: 0;
	font-size: 1.1em;
}

.po-result__actions {
	display: flex;
	gap: 8px;
}

.po-result__text {
	width: 100%;
	margin-top: 12px;
	resize: vertical;
	font-family: var(--font-face-monospace, monospace);
	line-height: 1.5;
}

.po-result__meta {
	margin: 6px 0 0;
	font-size: 0.85em;
	color: var(--color-text-maxcontrast, #767676);
}
</style>
