import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
	analyze,
	detectDocument,
	extractLaserTime,
	extractWeight,
	extractMaterial,
	extractUvInks,
	extractUvTime,
	extractUvTotal,
} from '../src/analysis.js'

const LASER_TEXT = `Total 'on' time (HH:MM:SS): 616:45:00
Total job processing time (HH:MM:SS): 20:04:36
Previous job processing time (HH:MM:SS.msec): 0:00:19.19
Total job 'laser on' time (HH:MM:SS): 9:24:22
Total job count: 704
X Total travel (M): 24228
Y Total travel (M): 751
Mainboard firmware version: RDLC-V7.09.06
OK`

const BAMBU_TEXT = `LH Druckauftrag senden x
schaltschrank_loch 7
& 32m54s (0 445g
Drucker ®
, MSPR X1C a Fy
_ Bambu Lab X1 Carbon 0.4mm SE)
Filament
PLA`

test('erkennt LightBurn-Text und liest die Laser-on-Zeit', () => {
	assert.equal(detectDocument(LASER_TEXT).type, 'laser')
	assert.equal(extractLaserTime(LASER_TEXT), '9:24:22')

	const result = analyze(LASER_TEXT)
	assert.equal(result.type, 'laser')
	assert.equal(result.laser.time, '9:24:22')
	assert.equal(result.bambu.material, null)
})

test('Laserzeit auch mit typografischen Anführungszeichen', () => {
	const text = 'Total job \u2018laser on\u2019 time (HH:MM:SS): 1:02:03'
	assert.equal(extractLaserTime(text), '1:02:03')
})

test('erkennt Bambu-Text, Gewicht (ohne Punkt) und Material', () => {
	assert.equal(detectDocument(BAMBU_TEXT).type, 'bambu')

	const result = analyze(BAMBU_TEXT)
	assert.equal(result.bambu.material, 'PLA')
	assert.equal(result.bambu.weight.value, 445)
	assert.equal(result.bambu.weight.corrected, 4.45)
	assert.equal(result.bambu.weight.exact, false)
})

test('Gewicht mit Dezimalpunkt wird exakt übernommen', () => {
	const weight = extractWeight('Gewicht: 4.45g')
	assert.equal(weight.value, 4.45)
	assert.equal(weight.corrected, null)
	assert.equal(weight.exact, true)
})

test('Gewicht mit Komma als Dezimaltrenner', () => {
	const weight = extractWeight('Gewicht: 12,5 g')
	assert.equal(weight.value, 12.5)
	assert.equal(weight.exact, true)
})

test('Materialliste erkennt PETG-CF vor PETG', () => {
	assert.equal(extractMaterial('Filament: PETG-CF'), 'PETG-CF')
	assert.equal(extractMaterial('Filament: PETG'), 'PETG')
	assert.equal(extractMaterial('ohne Materialangabe'), null)
})

test('fehlender Punkt bei vier Ziffern: 1137q -> Vorschlag 11.37', () => {
	const weight = extractWeight('45m & 1137q')
	assert.equal(weight.value, 1137)
	assert.equal(weight.corrected, 11.37)
	assert.equal(weight.exact, false)
})

test('Punkt erkannt, Einheitenzeichen verlesen: 11.37gq', () => {
	const weight = extractWeight('45m 11.37gq')
	assert.equal(weight.value, 11.37)
	assert.equal(weight.exact, true)
	assert.equal(weight.corrected, null)
})

test('führende Nullen: 007g -> Vorschlag 0.07', () => {
	const weight = extractWeight('007g')
	assert.equal(weight.value, 7)
	assert.equal(weight.corrected, 0.07)
})

test('0.4mm wird nicht als Gewicht erkannt', () => {
	assert.equal(extractWeight('Bambu Lab X1 Carbon 0.4mm'), null)
})

test('Dezimalpunkt mitten in Zahl wird nicht als Ganzzahl-Fallback gelesen', () => {
	const weight = extractWeight('11.37gq')
	assert.equal(weight.value, 11.37)
})

test('g als 9 verlesen: "4.45 9" -> 4.45', () => {
	const weight = extractWeight('(9 32m54s    @ 4.45 9')
	assert.equal(weight.value, 4.45)
	assert.equal(weight.exact, true)
})

test('g als 9 anhängig: "11379" -> 1137 / Vorschlag 11.37', () => {
	const weight = extractWeight('45m             & 11379')
	assert.equal(weight.value, 1137)
	assert.equal(weight.corrected, 11.37)
	assert.equal(weight.exact, false)
})

test('reine vierstellige Zahl ohne Einheit wird nicht als Gewicht erkannt', () => {
	assert.equal(extractWeight('1999'), null)
})

const UV_TEXT = `System prompt
Plate 01
Estimated time 32:41:20
Estimated material 12.15 mL
W 9.26 mL   C 1.04 mL   M 0.88 mL
Y 0.81 mL   K 0.16 mL   V 0.00 mL
S 0.00 mL
Printing risks
Some models have not been added supports
If continue, printability might be influenced.`

test('erkennt HeyGears-UV-Text', () => {
	const detection = detectDocument(UV_TEXT)
	assert.equal(detection.type, 'uv')
	assert.ok(detection.uvScore >= 2)
})

test('liest die sieben UV-Kanäle (mL) anhand der Labels', () => {
	const inks = extractUvInks(UV_TEXT)
	assert.deepEqual(inks, { W: 9.26, C: 1.04, M: 0.88, Y: 0.81, K: 0.16, V: 0, S: 0 })
})

test('UV-Kanäle auch bei Zeilenumbrüchen zwischen Label und Wert', () => {
	const text = 'Estimated material 12.15 mL\nW\n9.26 mL\nC\n1.04 mL\nM\n0.88 mL\n'
		+ 'Y\n0.81 mL\nK\n0.16 mL\nV\n0.00 mL\nS\n0.00 mL'
	assert.deepEqual(extractUvInks(text), { W: 9.26, C: 1.04, M: 0.88, Y: 0.81, K: 0.16, V: 0, S: 0 })
})

test('Positions-Fallback ohne lesbare Labels', () => {
	const text = 'Estimated time 32:41:20\nEstimated material 12.15 mL\n'
		+ '9.26 mL 1.04 mL 0.88 mL 0.81 mL 0.16 mL 0.00 mL 0.00 mL'
	assert.deepEqual(extractUvInks(text), { W: 9.26, C: 1.04, M: 0.88, Y: 0.81, K: 0.16, V: 0, S: 0 })
})

test('Estimated-material-Summe wird nicht als Kanal gewertet', () => {
	assert.equal(extractUvInks('Estimated material 12.15 mL'), null)
})

test('liest UV-Druckzeit und Material-Summe', () => {
	assert.equal(extractUvTime(UV_TEXT), '32:41:20')
	assert.equal(extractUvTotal(UV_TEXT), 12.15)
	assert.equal(extractUvTotal('ohne Summe'), null)
})

test('analyze liefert vollständige UV-Auswertung', () => {
	const result = analyze(UV_TEXT)
	assert.equal(result.type, 'uv')
	assert.deepEqual(result.uv.inks, { W: 9.26, C: 1.04, M: 0.88, Y: 0.81, K: 0.16, V: 0, S: 0 })
	assert.equal(result.uv.time, '32:41:20')
	assert.equal(result.uv.total, 12.15)
})

const box = (text, x0, y0, x1, y1) => ({ text, x0, y0, x1, y1 })

const UV_WORDS = [
	box('Estimated', 1083, 359, 1219, 384),
	box('time', 1230, 360, 1293, 384),
	box('32:41:20', 2200, 359, 2320, 384),
	box('Estimated', 1083, 433, 1219, 459),
	box('material', 1232, 433, 1343, 459),
	box('12.15', 2225, 435, 2303, 459),
	box('mL', 2316, 435, 2360, 459),
	box('(W)', 1094, 510, 1140, 565),
	box('9.26', 1155, 526, 1205, 546),
	box('mL', 1215, 526, 1250, 546),
	box('1.04', 1578, 526, 1625, 546),
	box('mL', 1635, 526, 1670, 546),
	box('IM]', 1936, 510, 1991, 565),
	box('0.88', 1997, 526, 2045, 546),
	box('mL', 2056, 526, 2091, 546),
	box('0.81', 1155, 591, 1201, 611),
	box('mL', 1215, 591, 1250, 611),
	box('IK]', 1514, 575, 1569, 630),
	box('0.16', 1576, 591, 1625, 611),
	box('mL', 1635, 591, 1670, 611),
	box('0.00', 1999, 591, 2045, 611),
	box('mL', 2056, 591, 2091, 611),
	box('0.00', 1155, 656, 1205, 676),
	box('mL', 1215, 656, 1250, 676),
]

test('rekonstruiert UV-Kanäle aus Wort-Boxen (Geometrie statt Labels)', () => {
	const result = analyze(UV_TEXT, { words: UV_WORDS })
	assert.deepEqual(result.uv.inks, { W: 9.26, C: 1.04, M: 0.88, Y: 0.81, K: 0.16, V: 0, S: 0 })
	assert.equal(result.uv.total, 12.15)
	assert.equal(result.uv.time, '32:41:20')
})
