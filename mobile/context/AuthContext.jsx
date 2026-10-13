import { Alert } from 'react-native';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import client, { saveTokens, clearTokens, setSessionExpiredHandler, TOKEN_KEY, REFRESH_KEY } from '../api/client';

const AuthContext = createContext(null);

/**
 * Session : jeton d'accès (1 h) renouvelé automatiquement par api/client.js avec le jeton de
 * renouvellement (30 jours). Si le renouvellement échoue, retour à l'accueil.
 */
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef(null);
  userRef.current = user;

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await client.get('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Démarrage : connecté si l'un des deux jetons existe (le jeton d'accès est renouvelé au besoin)
  useEffect(() => {
    Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(REFRESH_KEY)]).then(([t, r]) => {
      if (t || r) fetchMe();
      else        setLoading(false);
    });
  }, [fetchMe]);

  // Session impossible à renouveler (30 jours sans ouvrir l'app, déconnexion ailleurs...)
  useEffect(() => {
    setSessionExpiredHandler(() => {
      const wasSignedIn = !!userRef.current;
      setUser(null);
      if (wasSignedIn) {
        router.replace('/welcome');
        Alert.alert('Session expirée', 'Reconnecte-toi pour continuer.');
      }
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = async (email, password) => {
    const { data } = await client.post('/api/auth/login', { username: email, password });
    await saveTokens(data);
    await fetchMe();
    if (data.deletionCanceled) {
      Alert.alert('Bon retour !', 'La suppression de ton compte a été annulée.');
    }
  };

  const register = async (payload) => {
    await client.post('/api/auth/register', payload);
    await login(payload.email, payload.password);
  };

  /** Met à jour le profil (prénom, pseudo, préférences...) et l'utilisateur courant */
  const updateProfile = async (payload) => {
    const { data } = await client.patch('/api/profile', payload);
    setUser(data.user);
    return data.user;
  };

  /** Déconnexion de cet appareil : son jeton de renouvellement est annulé côté serveur */
  const logout = async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (refreshToken) client.post('/api/token/revoke', { refresh_token: refreshToken }).catch(() => {});
    await clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, refreshUser: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
