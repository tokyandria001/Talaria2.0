import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Détecte l'IP du PC automatiquement via Expo (fonctionne sur tous les réseaux)
const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? '10.61.47.6';
const API_URL = `http://${host}:8000`;

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) SecureStore.deleteItemAsync('token');
    return Promise.reject(err);
  }
);

export default client;
