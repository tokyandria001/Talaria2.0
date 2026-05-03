import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ⚠️  IP locale de la machine — pas localhost (Expo Go est sur le téléphone)
const API_URL = 'http://192.168.1.96:8000';

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
