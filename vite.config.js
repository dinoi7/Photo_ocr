import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const entry = fileURLToPath(new URL('./src/main.js', import.meta.url))

export default defineConfig({
	plugins: [vue()],
	// Library mode keeps `process.env.NODE_ENV` references by default, which
	// would throw "process is not defined" in the browser. Replace them.
	define: {
		'process.env.NODE_ENV': JSON.stringify('production'),
	},
	build: {
		outDir: 'js',
		emptyOutDir: false,
		cssCodeSplit: false,
		lib: {
			entry,
			name: 'PhotoOcr',
			formats: ['iife'],
			fileName: () => 'photo_ocr-main.js',
		},
		rollupOptions: {
			output: {
				assetFileNames: (assetInfo) => {
					const name = assetInfo.names ? assetInfo.names[0] : assetInfo.name
					if (name && name.endsWith('.css')) {
						return 'photo_ocr-main.css'
					}
					return 'assets/[name][extname]'
				},
			},
		},
	},
})
