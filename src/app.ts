import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/global.scss'

const App = createApp({
  setup() {
    return () => null
  },
})

App.use(createPinia())

export default App
