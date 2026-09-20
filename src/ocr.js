import { createWorker, PSM } from 'tesseract.js'

/**
 * Returns the web path to this app so that the locally bundled Tesseract
 * worker, WebAssembly core and language files can be loaded.
 */
function appBase() {
	if (window.OC && window.OC.appswebroots && window.OC.appswebroots.photo_ocr) {
		return window.OC.appswebroots.photo_ocr
	}
	if (window.OC && typeof window.OC.generateUrl === 'function') {
		return window.OC.generateUrl('/apps/photo_ocr')
	}
	return '/apps/photo_ocr'
}

const base = appBase()

const workerOptions = {
	workerPath: `${base}/js/tesseract/worker.min.js`,
	corePath: `${base}/js/tesseract/core`,
	langPath: `${base}/js/tesseract/lang`,
	workerBlobURL: false,
}

// Parameters that measurably improve recognition of numbers (especially
// decimal separators) on machine screenshots: tell Tesseract the DPI instead
// of letting it guess, keep spaces between words, and use automatic page
// segmentation (best overall for the LightBurn/Bambu UIs).
const workerParameters = {
	user_defined_dpi: '300',
	preserve_interword_spaces: '1',
	tessedit_pageseg_mode: PSM.AUTO,
}

let worker = null
let loadedLanguages = null

/**
 * Run OCR on the given image source.
 *
 * @param {File|Blob|string|HTMLImageElement} image image source
 * @param {string} languages tesseract language string, e.g. "deu+eng"
 * @param {(message: object) => void} onProgress progress callback
 * @return {Promise<string>} recognised text
 */
export async function recognize(image, languages, onProgress) {
	if (!worker || loadedLanguages !== languages) {
		if (worker) {
			await worker.terminate()
			worker = null
			loadedLanguages = null
		}
		worker = await createWorker(languages, 1, {
			...workerOptions,
			logger: (message) => {
				if (typeof onProgress === 'function' && message) {
					onProgress(message)
				}
			},
		})
		await worker.setParameters(workerParameters)
		loadedLanguages = languages
	}

	const { data } = await worker.recognize(image)
	return data.text || ''
}

/**
 * Release the worker again (e.g. when leaving the page).
 */
export async function terminate() {
	if (worker) {
		await worker.terminate()
		worker = null
		loadedLanguages = null
	}
}
