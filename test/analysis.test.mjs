import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
	analyze,
	detectDocument,
	extractLaserTime,
	extractWeight,
	extractMaterial,
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
