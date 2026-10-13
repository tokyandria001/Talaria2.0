/**
 * Complète app.json avec ce qui ne doit pas être écrit en dur dans le dépôt.
 *
 * GOOGLE_MAPS_API_KEY : clé « Maps SDK for Android », obligatoire pour afficher la carte dans un build
 * Android (Expo Go fournit la sienne). À déclarer comme variable d'environnement EAS :
 *   eas env:create --name GOOGLE_MAPS_API_KEY --value <clé> --environment preview --environment production --visibility sensitive
 */
export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY },
    },
  },
});
