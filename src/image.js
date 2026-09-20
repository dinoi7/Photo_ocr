const DEFAULTS = {
	rotation: 0,
	maxEdge: 2400,
	type: 'image/png',
	quality: 0.92,
	enhance: null,
}

/**
 * Load an image file into a drawable source. When supported, EXIF orientation
 * is applied automatically so that photos taken with a smartphone are upright.
 *
 * @param {File|Blob} file image file
 * @return {Promise<ImageBitmap|HTMLImageElement>} drawable source
 */
function loadBitmap(file) {
	if (typeof createImageBitmap === 'function') {
		return createImageBitmap(file, { imageOrientation: 'from-image' })
			.catch(() => createImageBitmap(file))
	}

	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file)
		const image = new Image()
		image.onload = () => {
			URL.revokeObjectURL(url)
			resolve(image)
		}
		image.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error('Bild konnte nicht geladen werden'))
		}
		image.src = url
	})
}

function sourceSize(source) {
	return {
		width: source.width || source.naturalWidth,
		height: source.height || source.naturalHeight,
	}
}

function needsEnhancement(enhance) {
	return Boolean(enhance && (enhance.gray || (enhance.contrast && enhance.contrast !== 1)))
}

/**
 * Apply a grayscale conversion and/or a contrast boost around mid-gray using a
 * plain pixel loop. Used as a fallback when the canvas does not support
 * `context.filter`.
 *
 * @param {CanvasRenderingContext2D} context canvas context
 * @param {number} width canvas width
 * @param {number} height canvas height
 * @param {{gray?: boolean, contrast?: number}} enhance enhancement options
 */
function applyEnhancement(context, width, height, enhance) {
	const image = context.getImageData(0, 0, width, height)
	const data = image.data
	const factor = enhance.contrast || 1

	for (let i = 0; i < data.length; i += 4) {
		if (enhance.gray) {
			let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
			if (factor !== 1) {
				lum = (lum - 128) * factor + 128
			}
			data[i] = lum < 0 ? 0 : lum > 255 ? 255 : lum
			data[i + 1] = data[i]
			data[i + 2] = data[i]
		} else if (factor !== 1) {
			for (let channel = 0; channel < 3; channel += 1) {
				const value = (data[i + channel] - 128) * factor + 128
				data[i + channel] = value < 0 ? 0 : value > 255 ? 255 : value
			}
		}
	}

	context.putImageData(image, 0, 0)
}

/**
 * Compute the render scale.
 *
 * Without enhancement, large images are only downscaled to `maxEdge`.
 * With enhancement (OCR), large images are downscaled to `downscaleEdge`
 * (phone photos would otherwise be needlessly huge and slow), while small
 * images (screenshots) are upscaled up to `upscale` times, capped by
 * `upscaleCap`.
 *
 * @param {number} maxDimension longest edge of the source
 * @param {{maxEdge: number, enhance: object|null}} options options
 * @return {number} scale factor
 */
function computeScale(maxDimension, { maxEdge, enhance }) {
	if (!enhance) {
		return Math.min(1, maxEdge / maxDimension)
	}

	const cap = enhance.upscaleCap || maxEdge
	if (maxDimension > cap) {
		return (enhance.downscaleEdge || maxEdge) / maxDimension
	}
	return Math.min(enhance.upscale || 1, cap / maxDimension)
}

/**
 * Render an image file to a Blob, applying an optional rotation, scaling and
 * optional grayscale/contrast enhancement.
 *
 * The returned Blob is what is shown as preview and sent to OCR, so both
 * always show the same orientation.
 *
 * @param {File|Blob} file image file
 * @param {object} options options
 * @param {number} [options.rotation] rotation in degrees
 * @param {number} [options.maxEdge] longest edge when not enhancing
 * @param {string} [options.type] output mime type
 * @param {number} [options.quality] output quality for lossy types
 * @param {{upscale?: number, upscaleCap?: number, downscaleEdge?: number, gray?: boolean, contrast?: number}|null} [options.enhance] enhancement options
 * @return {Promise<Blob>} rendered image (or the original file on failure)
 */
export async function renderImage(file, options = {}) {
	const { rotation, maxEdge, type, quality, enhance } = { ...DEFAULTS, ...options }
	const normalized = ((Math.round(rotation) % 360) + 360) % 360

	try {
		const source = await loadBitmap(file)
		const { width, height } = sourceSize(source)

		const scale = Math.max(computeScale(Math.max(width, height), { maxEdge, enhance }), 0.01)
		const drawWidth = Math.max(1, Math.round(width * scale))
		const drawHeight = Math.max(1, Math.round(height * scale))
		const isSideways = normalized === 90 || normalized === 270

		const canvas = document.createElement('canvas')
		canvas.width = isSideways ? drawHeight : drawWidth
		canvas.height = isSideways ? drawWidth : drawHeight

		const context = canvas.getContext('2d')
		context.imageSmoothingEnabled = true
		context.imageSmoothingQuality = 'high'

		context.translate(canvas.width / 2, canvas.height / 2)
		context.rotate((normalized * Math.PI) / 180)
		context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)

		if (source.close) {
			source.close()
		}

		if (needsEnhancement(enhance)) {
			applyEnhancement(context, canvas.width, canvas.height, enhance)
		}

		const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality))
		return blob || file
	} catch (error) {
		return file
	}
}
