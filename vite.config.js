import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import uni from '@dcloudio/uni-h5-vite'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    typeof uni === 'function' ? uni() : uni.default(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
