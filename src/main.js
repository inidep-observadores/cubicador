import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './services/install' // escuchar el aviso de instalación desde el arranque
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
