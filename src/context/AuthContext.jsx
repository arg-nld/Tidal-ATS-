import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

function loadPersistedUser() {
  try {
    const saved = localStorage.getItem('ats_user');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadPersistedUser);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Keep localStorage in sync
  useEffect(() => {
    if (user) {
      localStorage.setItem('ats_token', user.id);
      localStorage.setItem('ats_role', user.role);
      localStorage.setItem('ats_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ats_token');
      localStorage.removeItem('ats_role');
      localStorage.removeItem('ats_user');
    }
  }, [user]);

  const login = useCallback(async ({ email, password }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.auth.login({ email, password });
      setUser(res.user);
      return res.user;
    } catch (err) {
      setAuthError(err.message || 'Login failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (userData) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.auth.register(userData);
      setUser(res.user);
      return res.user;
    } catch (err) {
      setAuthError(err.message || 'Registration failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAuthError(null);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role || null,
      isHr: user?.role === 'hr',
      isApplicant: user?.role === 'applicant',
      isAuthenticated: !!user,
      loading,
      authError,
      login,
      register,
      logout,
      clearAuthError
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
