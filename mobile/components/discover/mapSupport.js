import { TurboModuleRegistry } from 'react-native';
import MapUnavailable from './MapUnavailable';

/**
 * La carte (MapLibre) n'est chargée que si l'app contient son code natif : sinon (Expo Go, ancien build)
 * un message la remplace, au lieu de faire planter l'écran au chargement.
 */
export const HAS_MAPLIBRE = !!TurboModuleRegistry.get('MLRNCameraModule');

export const MapPanel = HAS_MAPLIBRE ? require('./MapPanel').default : MapUnavailable;
