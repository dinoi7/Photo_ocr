/**
 * Analysis of OCR text for known machine screens:
 *  - LightBurn laser cutter "laser on" time
 *  - Bambu Lab 3D printer weight + filament material
 *
 * The OCR output can be noisy, so all patterns are intentionally tolerant
 * (typographic quotes, stray spaces, "0" instead of "o", ...).
 */

const LASER_KEYWORDS = [
	/laser\s*[o0]\s*n/i,
	/total\s+job/i,
	/lightburn/i,
	/mainboard\s+firmware/i,
	/total\s+travel/i,
	/job\s+processing\s+time/i,
]

const BAMBU_KEYWORDS = [
	/bambu/i,
	/\bx1\s*carbon\b/i,
	/filament/i,
	/druckauftrag/i,
	/send\s+print\s+job/i,
	/drucker/i,
	/\b(?:pla|petg|abs|asa|tpu|pa|pc|pva|hips)(?:[- ]?(?:cf|gf))?\b/i,
]

const MATERIALS = [
	'PLA-CF',
	'PETG-CF',
	'PA-CF',
	'PLA',
	'PETG',
	'ABS',
	'ASA',
	'TPU',
	'PVA',
	'HIPS',
	'PC',
	'PA',
	'PPS',
	'Support W',
	'Support G',
]

const TIME_PATTERN = /(\d{1,3})\s*[:.]\s*(\d{2})\s*[:.]\s*(\d{2})/
const LASER_ON_PATTERN = /laser\s*[o0]\s*n/i

function countMatches(text, patterns) {
	let score = 0
	for (const pattern of patterns) {
		if (pattern.test(text)) {
			score += 1
		}
	}
	return score
}

function normalizeTime(hours, minutes, seconds) {
	return `${Number.parseInt(hours, 10)}:${minutes}:${seconds}`
}

/**
 * Guess which kind of screenshot the text belongs to.
 *
 * @param {string} text OCR text
 * @return {{type: 'laser'|'bambu'|'unknown', laserScore: number, bambuScore: number}} detection
 */
export function detectDocument(text) {
	const source = text || ''
	const laserScore = countMatches(source, LASER_KEYWORDS)
	const bambuScore = countMatches(source, BAMBU_KEYWORDS)

	let type = 'unknown'
	if (laserScore >= 2 || bambuScore >= 2) {
		if (laserScore > bambuScore) {
			type = 'laser'
		} else if (bambuScore > laserScore) {
			type = 'bambu'
		}
	}

	return { type, laserScore, bambuScore }
}

/**
 * Extract the "laser on" time (HH:MM:SS) from LightBurn style output.
 *
 * @param {string} text OCR text
 * @return {string|null} normalized time or null
 */
export function extractLaserTime(text) {
	const lines = (text || '').split(/\r?\n/)

	for (const line of lines) {
		if (LASER_ON_PATTERN.test(line)) {
			const match = line.match(TIME_PATTERN)
			if (match) {
				return normalizeTime(match[1], match[2], match[3])
			}
		}
	}

	// Fallback: a line that at least mentions "laser" and contains a time.
	for (const line of lines) {
		if (/laser/i.test(line)) {
			const match = line.match(TIME_PATTERN)
			if (match) {
				return normalizeTime(match[1], match[2], match[3])
			}
		}
	}

	return null
}

/**
 * Find the filament material (PLA, PETG, ...).
 *
 * @param {string} text OCR text
 * @return {string|null} material or null
 */
export function extractMaterial(text) {
	const source = text || ''
	for (const material of MATERIALS) {
		const flexible = material.replace(/[-\s]+/g, '[\\s-]?')
		const pattern = new RegExp(`(^|[^A-Za-z0-9])${flexible}([^A-Za-z0-9]|$)`, 'i')
		if (pattern.test(source)) {
			return material
		}
	}
	return null
}

/**
 * Repair common OCR misreads of the unit "g": it is frequently recognised as
 * "9" (e.g. "4.45 9" or "11379" instead of "4.45 g" / "11.37 g").
 *
 * @param {string} text OCR text
 * @return {string} text with repaired units
 */
function normalizeUnitMisreads(text) {
	return text
		.replace(/(\d[.,]\d+)[ \t]*9(?=\s|$)/g, '$1g')
		.replace(/(?<![\d.,])(\d{4})[ \t]*9(?=\s|$)/g, '$1g')
}

/**
 * Find the print weight.
 *
 * Bambu Studio shows e.g. "4.45g". OCR sometimes drops the decimal point and
 * returns "445g"; in that case a suggested value is provided as well.
 *
 * @param {string} text OCR text
 * @return {{raw: string, value: number, corrected: number|null, exact: boolean}|null} weight
 */
export function extractWeight(text) {
	const source = normalizeUnitMisreads(text || '')

	// A decimal separator is present (dot or comma). The unit may be
	// misread as "q" and doubled ("gq").
	const exact = source.match(/(?<![\d.,])(\d{1,4})[.,](\d{1,3})[ \t]*[gq]{1,2}(?![a-z])/i)
	if (exact) {
		return {
			raw: exact[0].trim(),
			value: Number(`${exact[1]}.${exact[2]}`),
			corrected: null,
			exact: true,
		}
	}

	// No separator: Bambu Studio always shows two decimals, so the digits are
	// interpreted as hundredths ("445" -> 4.45, "1137" -> 11.37).
	const loose = source.match(/(?<![\d.,])(\d{1,4})[ \t]*[gq]{1,2}(?![a-z])/i)
	if (loose) {
		const value = Number(loose[1])
		const corrected = Number((value / 100).toFixed(2))
		return {
			raw: loose[0].trim(),
			value,
			corrected,
			exact: false,
		}
	}

	return null
}

/**
 * Run the full analysis: document type plus all values that could be found.
 *
 * @param {string} text OCR text
 * @return {object} analysis result
 */
export function analyze(text) {
	const source = text || ''
	const detection = detectDocument(source)

	return {
		type: detection.type,
		laserScore: detection.laserScore,
		bambuScore: detection.bambuScore,
		laser: {
			time: extractLaserTime(source),
		},
		bambu: {
			weight: extractWeight(source),
			material: extractMaterial(source),
		},
	}
}
