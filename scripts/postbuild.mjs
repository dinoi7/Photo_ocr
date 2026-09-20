/**
 * Post-build script for the photo_ocr Nextcloud app.
 *
 * 1. Moves the compiled stylesheet from js/ to css/ (Nextcloud expects
 *    styles in the app's css/ folder).
 * 2. Copies the Tesseract.js worker and core (WebAssembly) files into
 *    js/tesseract/ so that everything is served from the app itself.
 * 3. Ensures the German and English language files are available under
 *    js/tesseract/lang/ (downloading them once if they are missing).
 */

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, renameSync, copyFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { get } from 'node:https'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const jsDir = join(root, 'js')
const cssDir = join(root, 'css')
const tessDir = join(jsDir, 'tesseract')
const coreDir = join(tessDir, 'core')
const langDir = join(tessDir, 'lang')

function log(message) {
	console.log(`[postbuild] ${message}`)
}

function ensureDir(dir) {
	mkdirSync(dir, { recursive: true })
}

// --- 1. Move compiled CSS -------------------------------------------------
const builtCss = join(jsDir, 'photo_ocr-main.css')
if (existsSync(builtCss)) {
	ensureDir(cssDir)
	renameSync(builtCss, join(cssDir, 'photo_ocr-main.css'))
	log('moved stylesheet to css/photo_ocr-main.css')
}

// --- 2. Copy Tesseract worker + core -------------------------------------
ensureDir(tessDir)
ensureDir(coreDir)

const tesseractDist = dirname(require.resolve('tesseract.js/package.json'))
const workerSource = join(tesseractDist, 'dist', 'worker.min.js')
if (existsSync(workerSource)) {
	copyFileSync(workerSource, join(tessDir, 'worker.min.js'))
	log('copied tesseract worker')
}

const corePkg = dirname(require.resolve('tesseract.js-core/package.json'))
for (const file of readdirSync(corePkg)) {
	if (/\.(wasm|wasm\.js)$/.test(file)) {
		copyFileSync(join(corePkg, file), join(coreDir, file))
	}
}
log('copied tesseract wasm core')

// --- 3. Language data ----------------------------------------------------
ensureDir(langDir)

const languages = ['eng', 'deu']
// "fast" language data keeps the first-load download small (~3 MB total
// instead of ~18 MB) while still being accurate enough for text/numbers.
const remoteBase = 'https://tessdata.projectnaptha.com/4.0.0_fast'
const redirectLimit = 5

function download(url, destination, redirectsLeft = redirectLimit) {
	return new Promise((resolvePromise, reject) => {
		get(url, (response) => {
			if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
				response.resume()
				if (redirectsLeft <= 0 || !response.headers.location) {
					reject(new Error(`too many redirects for ${url}`))
					return
				}
				download(response.headers.location, destination, redirectsLeft - 1).then(resolvePromise, reject)
				return
			}
			if (response.statusCode !== 200) {
				response.resume()
				reject(new Error(`HTTP ${response.statusCode} for ${url}`))
				return
			}
			const chunks = []
			response.on('data', (chunk) => chunks.push(chunk))
			response.on('end', () => {
				writeFileSync(destination, Buffer.concat(chunks))
				resolvePromise()
			})
		}).on('error', reject)
	})
}

for (const lang of languages) {
	const destination = join(langDir, `${lang}.traineddata.gz`)
	if (existsSync(destination) && statSync(destination).size > 0) {
		log(`language ${lang} already present`)
		continue
	}
	log(`downloading language ${lang} ...`)
	try {
		await download(`${remoteBase}/${lang}.traineddata.gz`, destination)
		log(`downloaded ${lang}.traineddata.gz`)
	} catch (error) {
		log(`WARNING: could not download ${lang}: ${error.message}`)
		log('place the file manually in js/tesseract/lang/')
	}
}

log('done')
