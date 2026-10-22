import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Restore the session from the stored access token on first load.
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    api.get('/auth/me')
      .then(({ data }) => {
        if (!cancelled) setUser(data.data.user);
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    localStorage.setItem('accessToken', data.data.accessToken);
    setUser(data.data.user);
    return data.data;
  }, []);

  const register = useCallback(async (values) => {
    const { data } = await api.post('/auth/register', values);
    localStorage.setItem('accessToken', data.data.accessToken);
    setUser(data.data.user);
    return data.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logging out locally still matters if the network call fails.
    }
    localStorage.removeItem('accessToken');
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const updateUser = useCallback((updated) => {
    setUser((prev) => ({ ...(prev || {}), ...updated }));
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
    isAuthenticated: Boolean(user),
  }), [user, loading, login, register, logout, updateUser, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
