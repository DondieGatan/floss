import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, ApiError, setTokens, clearTokens, getAccessToken } from '../api/client';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.get('/auth/me');
        setUser(data.user);
      } catch {
        clearTokens();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const register = useCallback(async (fullName, email, password) => {
    const data = await api.post('/auth/register', { fullName, email, password });
    setTokens(data);
    setUser(data.user);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    if (data.requiresTwoFactor) {
      // Password was correct but that's not enough on its own — hand back
      // the pending token so the caller can prompt for a second factor
      // instead of ending up "logged in" here. twoFactorMethod ('totp' or
      // 'email') tells the caller which prompt to show; devCode only ever
      // arrives when no real email provider is configured (see
      // app/auth/routes.py's login()), so the flow stays testable without one.
      return {
        requiresTwoFactor: true,
        twoFactorToken: data.twoFactorToken,
        twoFactorMethod: data.twoFactorMethod,
        devCode: data.devCode,
      };
    }
    setTokens(data);
    setUser(data.user);
    return { requiresTwoFactor: false };
  }, []);

  const completeTwoFactorLogin = useCallback(async (twoFactorToken, code) => {
    const data = await api.post('/auth/2fa/verify-login', { twoFactorToken, code });
    setTokens(data);
    setUser(data.user);
  }, []);

  // Only meaningful for the email method — issues a fresh code/token pair
  // (the old one still works too until it expires; see the resend route's
  // own docstring) when the first email didn't arrive or the user waited
  // too long to check their inbox.
  const resendTwoFactorEmailCode = useCallback(async (twoFactorToken) => {
    return api.post('/auth/2fa/resend-email-code', { twoFactorToken });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // best-effort — clear local state regardless
    }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, register, login, completeTwoFactorLogin, resendTwoFactorEmailCode, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
