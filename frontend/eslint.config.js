import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'scripts/render-smoke/out.mjs']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, process: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Forms and drawers intentionally reset their local state when they open.
      // That pattern is safe here (the state is local and the effect only runs on
      // an open/close transition) but the React Compiler lint flags it as an error.
      'react-hooks/set-state-in-effect': 'warn',
      // Contexts and the toast module export a hook next to their provider.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
])
