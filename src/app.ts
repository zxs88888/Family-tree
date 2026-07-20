import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/global.scss'

const App = createApp({})

App.use(createPinia())

export default App
