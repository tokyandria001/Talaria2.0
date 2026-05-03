import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    SecureStore.getItemAsync('token').then((t) => {
      if (t) fetchMe();
      else    setLoading(false);
    });
  }, [fetchMe]);

  const login = async (email, password) => {
    const { data } = await client.post('/api/auth/login', { username: email, password });
    await SecureStore.setItemAsync('token', data.token);
    await fetchMe();
  };

  const register = async (payload) => {
    await client.post('/api/auth/register', payload);
    await login(payload.email, payload.password);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
