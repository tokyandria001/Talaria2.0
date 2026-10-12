import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Chargements de données dans useEffect (motif utilisé dans toute l'app) : conseil de
      // performance, pas un bug. À refactorer progressivement ; ne bloque pas la CI.
      'react-hooks/set-state-in-effect': 'warn',
      // Ne concerne que le rechargement à chaud en développement (AuthContext exporte aussi useAuth)
      'react-refresh/only-export-components': 'warn',
    },
  },
])
