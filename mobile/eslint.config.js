// Lint de l'app mobile (lancé en CI) : npx expo lint
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*'] },
  {
    rules: {
      // Règle pensée pour le HTML : une apostrophe dans un <Text> est sans risque en React Native
      'react/no-unescaped-entities': 'off',
    },
    settings: {
      // Fourni par le paquet expo (dépendance indirecte)
      'import/core-modules': ['@expo/vector-icons'],
    },
  },
]);
