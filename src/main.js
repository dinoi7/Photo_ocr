import { createApp } from 'vue'
import App from './App.vue'

const mountPoint = document.getElementById('photo-ocr-app')

if (mountPoint) {
	createApp(App).mount(mountPoint)
}
