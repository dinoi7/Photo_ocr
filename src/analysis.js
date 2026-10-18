/**
 * Analysis of OCR text for known machine screens:
 *  - LightBurn laser cutter "laser on" time
 *  - Bambu Lab 3D printer weight + filament material
 *  - HeyGears UV/resin printer channel volumes (W, C, M, Y, K, V, S)
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

const UV_KEYWORDS = [
	/estimated\s+material/i,
	/estimated\s+time/i,
	/printing\s+risks/i,
	/heygears/i,
	/varnish/i,
	/\bslice\b/i,
	/plate\s*0?\d/i,
	/\d[.,]?\d*\s*ml\b/i,
]

// Channels of a HeyGears UV/resin printer. `aliases` are matched as standalone
// tokens; the positional fallback uses the on-screen order (see below).
const UV_CHANNELS = [
	{ key: 'W', aliases: ['W', 'Weiss', 'Wei\u00df', 'White'] },
	{ key: 'C', aliases: ['C', 'Cyan'] },
	{ key: 'M', aliases: ['M', 'Magenta'] },
	{ key: 'Y', aliases: ['Y', 'Yellow'] },
	{ key: 'K', aliases: ['K', 'Black'] },
	{ key: 'V', aliases: ['V', 'Varnish'] },
	{ key: 'S', aliases: ['S', 'Support'] },
]

// Order in which the HeyGears UI lists the channels (row by row).
const UV_POSITION_ORDER = ['W', 'C', 'M', 'Y', 'K', 'V', 'S']

const VOLUME_UNIT = '(?:mL|mI|ml|m1|mi)'

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
 * @return {{type: 'laser'|'bambu'|'uv'|'unknown', laserScore: number, bambuScore: number, uvScore: number}} detection
 */
export function detectDocument(text) {
	const source = text || ''
	const scores = {
		laser: countMatches(source, LASER_KEYWORDS),
		bambu: countMatches(source, BAMBU_KEYWORDS),
		uv: countMatches(source, UV_KEYWORDS),
	}

	const best = Math.max(scores.laser, scores.bambu, scores.uv)
	let type = 'unknown'
	if (best >= 2) {
		const winners = Object.keys(scores).filter((key) => scores[key] === best)
		if (winners.length === 1) {
			[type] = winners
		}
	}

	return {
		type,
		laserScore: scores.laser,
		bambuScore: scores.bambu,
		uvScore: scores.uv,
	}
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

function escapeToken(token) {
	return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Read the volume of a single UV channel by anchoring on its label.
 *
 * @param {string} source OCR text
 * @param {string[]} aliases accepted labels (e.g. "W", "White")
 * @return {number|null} volume in mL or null
 */
function matchChannelVolume(source, aliases) {
	for (const alias of aliases) {
		const pattern = new RegExp(
			`(?:^|[^A-Za-z])${escapeToken(alias)}(?![A-Za-z])[\\s:.\\-]{0,15}?(\\d{1,4}(?:[.,]\\d+)?)\\s*${VOLUME_UNIT}`,
			'i',
		)
		const match = source.match(pattern)
		if (match) {
			return Number(match[1].replace(',', '.'))
		}
	}
	return null
}

/**
 * Fallback when the channel badges were not recognised: collect every volume
 * on screen (ignoring the "Estimated material" total) and map them to the
 * channels in their fixed on-screen order.
 *
 * @param {string} source OCR text
 * @return {object|null} map of channel -> volume or null
 */
function positionalUvInks(source) {
	const text = source
		.split(/\r?\n/)
		.filter((line) => !/estimated\s+material/i.test(line))
		.join('\n')

	const values = []
	const pattern = new RegExp(`(\\d{1,4}(?:[.,]\\d+)?)\\s*${VOLUME_UNIT}\\b`, 'gi')
	let match = pattern.exec(text)
	while (match) {
		values.push(Number(match[1].replace(',', '.')))
		match = pattern.exec(text)
	}

	if (values.length !== UV_POSITION_ORDER.length) {
		return null
	}

	const inks = {}
	UV_POSITION_ORDER.forEach((key, index) => {
		inks[key] = values[index]
	})
	return inks
}

const VOLUME_INLINE = /(\d{1,4}(?:[.,]\d+)?)\s*(?:mL|mI|ml|m1|mi|m\|)/i
const TRAILING_NUMBER = /(?:^|[^\d.,])(\d{1,4}(?:[.,]\d+)?)$/
const UNIT_ONLY = /^(?:mL|mI|ml|m1|mi|m\|)$/i
const TIME_ONLY = /^(\d{1,3})\s*[:.]\s*(\d{2})\s*[:.]\s*(\d{2})$/

function wordHeight(word) {
	return Math.max((word.y1 || 0) - (word.y0 || 0), 1)
}

function wordCenterY(word) {
	return ((word.y0 || 0) + (word.y1 || 0)) / 2
}

function wordCenterX(word) {
	return ((word.x0 || 0) + (word.x1 || 0)) / 2
}

function sameRow(a, b) {
	const tolerance = Math.max(wordHeight(a), wordHeight(b)) * 0.6
	return Math.abs(wordCenterY(a) - wordCenterY(b)) <= tolerance
}

/**
 * Collect all "12.34 mL" values with their word boxes.
 *
 * @param {object[]} words tesseract words (text + bbox)
 * @return {object[]} volumes with value and word
 */
function collectVolumes(words) {
	const list = words || []
	const volumes = []

	for (let i = 0; i < list.length; i += 1) {
		const word = list[i]
		const text = String((word && word.text) || '').trim()
		if (!text) {
			continue
		}

		const inline = text.match(VOLUME_INLINE)
		if (inline) {
			volumes.push({ value: Number(inline[1].replace(',', '.')), word })
			continue
		}

		const next = list[i + 1]
		if (!next || !UNIT_ONLY.test(String(next.text || '').trim()) || !sameRow(word, next)) {
			continue
		}

		// The badge is sometimes merged into the number word (e.g. "*$+0.00").
		const number = text.match(TRAILING_NUMBER)
		if (number) {
			volumes.push({ value: Number(number[1].replace(',', '.')), word })
			i += 1
		}
	}

	return volumes
}

/**
 * Split the channel volumes from the "Estimated material" total. The total is
 * either on the label's line or, failing that, the value equal to the sum of
 * the other seven.
 *
 * @param {object[]} volumes collected volumes
 * @param {object[]} words tesseract words
 * @return {{channels: object[], total: number|null}|null} split result
 */
function separateTotal(volumes, words) {
	if (volumes.length === 7) {
		return { channels: volumes, total: null }
	}

	const material = (words || []).find((word) => /^material$/i.test(String((word && word.text) || '').trim()))
	if (material && volumes.length > 7) {
		const tolerance = Math.max(wordHeight(material), 10)
		const index = volumes.findIndex((volume) => (
			Math.abs(wordCenterY(volume.word) - wordCenterY(material)) <= tolerance
			&& (volume.word.x0 || 0) > (material.x1 || 0)
		))
		if (index >= 0) {
			return {
				channels: volumes.filter((_, position) => position !== index),
				total: volumes[index].value,
			}
		}
	}

	if (volumes.length === 8) {
		for (let i = 0; i < volumes.length; i += 1) {
			const rest = volumes.filter((_, position) => position !== i)
			const sum = rest.reduce((total, volume) => total + volume.value, 0)
			if (Math.abs(sum - volumes[i].value) <= 0.06) {
				return { channels: rest, total: volumes[i].value }
			}
		}
	}

	return null
}

/**
 * Reconstruct the UV channel grid from word boxes.
 *
 * The badge letters (W, C, M, ...) are small and often misread, while the
 * volume numbers are reliable. The values sit in a fixed 3-column grid
 * (row 1: W C M, row 2: Y K V, row 3: S), so they are ordered by row and
 * column instead of relying on the labels.
 *
 * @param {object[]} words tesseract words
 * @return {{inks: object, total: number|null}|null} result or null
 */
function uvFromWords(words) {
	if (!Array.isArray(words) || words.length === 0) {
		return null
	}

	const split = separateTotal(collectVolumes(words), words)
	if (!split || split.channels.length !== 7) {
		return null
	}

	const sorted = [...split.channels].sort((a, b) => wordCenterY(a.word) - wordCenterY(b.word))
	const rows = []
	for (const volume of sorted) {
		const row = rows[rows.length - 1]
		const tolerance = Math.max(wordHeight(volume.word) * 1.2, 8)
		if (row && Math.abs(wordCenterY(volume.word) - row.center) <= tolerance) {
			row.items.push(volume)
		} else {
			rows.push({ center: wordCenterY(volume.word), items: [volume] })
		}
	}

	const ordered = []
	for (const row of rows) {
		row.items.sort((a, b) => wordCenterX(a.word) - wordCenterX(b.word))
		ordered.push(...row.items)
	}

	if (ordered.length !== UV_POSITION_ORDER.length) {
		return null
	}

	const inks = {}
	UV_POSITION_ORDER.forEach((key, index) => {
		inks[key] = ordered[index].value
	})
	return { inks, total: split.total }
}

/**
 * Find the job time from word boxes, preferring the value next to "time".
 *
 * @param {object[]} words tesseract words
 * @return {string|null} normalized time or null
 */
function uvTimeFromWords(words) {
	const list = words || []
	const times = []
	for (const word of list) {
		const match = String((word && word.text) || '').trim().match(TIME_ONLY)
		if (match) {
			times.push({ match, word })
		}
	}
	if (times.length === 0) {
		return null
	}

	let chosen = times[0]
	const label = list.find((word) => /^time$/i.test(String((word && word.text) || '').trim()))
	if (label) {
		chosen = times.reduce((best, current) => {
			const bestDistance = Math.abs(wordCenterY(best.word) - wordCenterY(label))
			const currentDistance = Math.abs(wordCenterY(current.word) - wordCenterY(label))
			return currentDistance < bestDistance ? current : best
		})
	}

	const [, hours, minutes, seconds] = chosen.match
	return normalizeTime(hours, minutes, seconds)
}

/**
 * Read the seven UV/resin channel volumes (W, C, M, Y, K, V, S) in mL.
 *
 * @param {string} text OCR text
 * @param {object[]} [words] tesseract words with bounding boxes
 * @return {object|null} map of channel -> volume or null
 */
export function extractUvInks(text, words) {
	const source = text || ''
	const geometry = uvFromWords(words)
	if (geometry) {
		return geometry.inks
	}

	const inks = {}
	let found = 0

	for (const channel of UV_CHANNELS) {
		const value = matchChannelVolume(source, channel.aliases)
		if (value !== null) {
			inks[channel.key] = value
			found += 1
		}
	}

	if (found === UV_POSITION_ORDER.length) {
		return inks
	}

	const positional = positionalUvInks(source)
	if (positional) {
		return positional
	}

	return found > 0 ? inks : null
}

/**
 * Extract the "Estimated time" (HH:MM:SS) of a UV job.
 *
 * @param {string} text OCR text
 * @param {object[]} [words] tesseract words with bounding boxes
 * @return {string|null} normalized time or null
 */
export function extractUvTime(text, words) {
	const geometry = uvTimeFromWords(words)
	if (geometry) {
		return geometry
	}

	const source = text || ''
	const match = source.match(/estimated\s+time[\s\S]{0,20}?(\d{1,3})\s*[:.]\s*(\d{2})\s*[:.]\s*(\d{2})/i)
	if (match) {
		return normalizeTime(match[1], match[2], match[3])
	}
	return null
}

/**
 * Extract the "Estimated material" total (mL).
 *
 * @param {string} text OCR text
 * @param {object[]} [words] tesseract words with bounding boxes
 * @return {number|null} total in mL or null
 */
export function extractUvTotal(text, words) {
	const geometry = uvFromWords(words)
	if (geometry && geometry.total !== null) {
		return geometry.total
	}

	const source = text || ''
	const pattern = new RegExp(`estimated\\s+material[\\s\\S]{0,20}?(\\d{1,4}(?:[.,]\\d+)?)\\s*${VOLUME_UNIT}`, 'i')
	const match = source.match(pattern)
	if (match) {
		return Number(match[1].replace(',', '.'))
	}
	return null
}

/**
 * Run the full analysis: document type plus all values that could be found.
 *
 * @param {string} text OCR text
 * @param {{words?: object[]}} [options] optional tesseract word boxes
 * @return {object} analysis result
 */
export function analyze(text, options = {}) {
	const source = text || ''
	const words = options.words
	const detection = detectDocument(source)

	return {
		type: detection.type,
		laserScore: detection.laserScore,
		bambuScore: detection.bambuScore,
		uvScore: detection.uvScore,
		laser: {
			time: extractLaserTime(source),
		},
		bambu: {
			weight: extractWeight(source),
			material: extractMaterial(source),
		},
		uv: {
			inks: extractUvInks(source, words),
			time: extractUvTime(source, words),
			total: extractUvTotal(source, words),
		},
	}
}
