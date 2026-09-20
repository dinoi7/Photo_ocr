<template>
	<fieldset class="po-langs">
		<legend class="po-langs__legend">Sprache der Texterkennung</legend>
		<div class="po-langs__options">
			<label v-for="option in options" :key="option.value" class="po-langs__option">
				<input
					type="radio"
					name="po-langs"
					:value="option.value"
					:checked="modelValue === option.value"
					@change="$emit('update:modelValue', option.value)"
				>
				<span>{{ option.label }}</span>
			</label>
		</div>
	</fieldset>
</template>

<script>
export default {
	name: 'LanguageSelect',
	props: {
		modelValue: {
			type: String,
			default: 'deu+eng',
		},
	},
	emits: ['update:modelValue'],
	data() {
		return {
			options: [
				{ value: 'deu+eng', label: 'Deutsch + Englisch' },
				{ value: 'deu', label: 'Nur Deutsch' },
				{ value: 'eng', label: 'Nur Englisch' },
			],
		}
	},
}
</script>

<style scoped>
.po-langs {
	margin: 16px 0 0;
	padding: 0;
	border: none;
}

.po-langs__legend {
	padding: 0;
	margin-bottom: 6px;
	font-weight: 600;
}

.po-langs__options {
	display: flex;
	flex-wrap: wrap;
	gap: 8px 20px;
}

.po-langs__option {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	cursor: pointer;
}
</style>
