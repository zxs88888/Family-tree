import path from 'path'
import dotenv from 'dotenv'
import type { UserConfigExport } from '@tarojs/cli'

dotenv.config()

export default {
  projectName: 'family',
  date: '2025-7-17',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-framework-vue3', '@tarojs/plugin-platform-h5', '@tarojs/plugin-platform-weapp'],
  alias: {
    '@': path.resolve(__dirname, '..', 'src'),
  },
  defineConstants: {
    'process.env.TARO_APP_SUPABASE_URL': JSON.stringify(process.env.TARO_APP_SUPABASE_URL || ''),
    'process.env.TARO_APP_SUPABASE_ANON_KEY': JSON.stringify(process.env.TARO_APP_SUPABASE_ANON_KEY || ''),
  },
  copy: { patterns: [], options: {} },
  framework: 'vue3',
  compiler: {
    type: 'webpack5',
    prebundle: { enable: false },
  },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    router: { mode: 'hash' },
    esnextModules: ['taro-ui-vue3'],
    postcss: {
      autoprefixer: { enable: true, config: {} },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },
} satisfies UserConfigExport
