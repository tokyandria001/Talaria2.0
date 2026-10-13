import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// En local : définir EXPO_PUBLIC_API_URL dans mobile/.env.local (ex. http://192.168.1.20:8000)
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.talaria.world';

/** Clés du stockage sécurisé : jeton d'accès (1 h) et jeton de renouvellement (30 jours) */
export const TOKEN_KEY = 'token';
export const REFRESH_KEY = 'refreshToken';

const client = axios.create({ baseURL: API_URL });

/** Enregistre les jetons reçus (connexion, renouvellement, changement de mot de passe) */
export async function saveTokens({ token, refresh_token: refreshToken }) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

/** Appelé quand la session ne peut plus être renouvelée (AuthContext ramène à l'accueil) */
let onSessionExpired = null;
export const setSessionExpiredHandler = (handler) => { onSessionExpired = handler; };

client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Renouvellement du jeton d'accès, une seule fois même si plusieurs requêtes échouent en même temps.
 * Requête faite sans `client` (pas d'intercepteurs : pas de boucle).
 */
let refreshing = null;
function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
      if (!refreshToken) throw new Error('no refresh token');
      const { data } = await axios.post(`${API_URL}/api/token/refresh`, { refresh_token: refreshToken });
      await saveTokens(data);
      return data.token;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

/** Routes où un 401 veut dire « mauvais identifiants », pas « session expirée » */
const AUTH_ROUTES = ['/api/auth/login', '/api/auth/register', '/api/token/'];

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isAuthRoute = AUTH_ROUTES.some(path => original?.url?.includes(path));
    // 401 du jeton (« Expired JWT Token », « JWT Token not found »...) et pas un mauvais mot de passe
    const isTokenError = /JWT/i.test(err.response?.data?.message ?? '');
    if (err.response?.status !== 401 || !isTokenError || !original || original._retried || isAuthRoute) {
      return Promise.reject(err);
    }

    // Jeton d'accès expiré : on le renouvelle sans rien demander, puis on rejoue la requête
    try {
      const token = await refreshSession();
      original._retried = true;
      original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
      return client(original);
    } catch {
      await clearTokens();
      onSessionExpired?.();
      return Promise.reject(err);
    }
  },
);

export default client;

/** URL complète d'un fichier envoyé sur le serveur (ex. /uploads/groups/12_abc.jpg) */
export const assetUrl = (path) => (path?.startsWith('/') ? `${API_URL}${path}` : path || null);
