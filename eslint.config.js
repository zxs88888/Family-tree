import pluginVue from 'eslint-plugin-vue'
import vuePrettierConfig from '@vue/eslint-config-prettier'

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...pluginVue.configs['flat/recommended'],
  vuePrettierConfig,
  {
    languageOptions: {
      globals: {
        uni: 'readonly',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
]
