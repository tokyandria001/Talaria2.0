/**
 * Connexion avec Google (module natif @react-native-google-signin/google-signin).
 * Absent d'Expo Go et des APK construits avant son ajout : `googleAvailable` vaut alors false
 * et l'app reste utilisable (bouton qui invite à mettre l'app à jour).
 */

// ID client OAuth « Web » : le jeton Google lui est destiné, le serveur vérifie le même (public, pas un secret)
const WEB_CLIENT_ID = '688722692928-dn8e3melnk939itijm8r1e7maoh95j4g.apps.googleusercontent.com';

let mod = null;
try {
  mod = require('@react-native-google-signin/google-signin');
  mod.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
} catch {
  mod = null;
}

export const googleAvailable = !!mod;

/** Ouvre le choix du compte Google. Renvoie le jeton d'identité, ou null si l'utilisateur annule. */
export async function getGoogleIdToken() {
  if (!mod) throw new Error('unavailable');
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = mod;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    if (!res.data.idToken) throw new Error('Google n\'a pas renvoyé de jeton.');
    return res.data.idToken;
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.IN_PROGRESS) return null;
    if (isErrorWithCode(err) && err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Les services Google Play sont nécessaires pour se connecter avec Google.');
    }
    throw err;
  }
}

/** À la déconnexion : le prochain « Continuer avec Google » redemande le compte à utiliser */
export function googleSignOut() {
  mod?.GoogleSignin.signOut().catch(() => {});
}
