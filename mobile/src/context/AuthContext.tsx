import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AuthTokens, AuthUser, LoginPayload, RegisterPayload } from '../types/auth';
import * as authApi from '../services/authApi';
import { clearTokens, loadTokens, saveTokens } from '../services/secureAuthStorage';

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  initializing: boolean;
  loginLoading: boolean;
  registerLoading: boolean;
  errorMessage: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const persistedTokens = await loadTokens();
        if (!persistedTokens) return;

        try {
          const profile = await authApi.me(persistedTokens.accessToken);
          setUser(profile.user);
          setTokens(persistedTokens);
          return;
        } catch {
          const refreshed = await authApi.refresh(persistedTokens.refreshToken);
          await saveTokens({ accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken });
          const profile = await authApi.me(refreshed.accessToken);
          setUser(profile.user);
          setTokens({ accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken });
        }
      } catch {
        await clearTokens();
        setUser(null);
        setTokens(null);
      } finally {
        setInitializing(false);
      }
    };

    restoreSession().catch(() => setInitializing(false));
  }, []);

  const handleAuthSuccess = async (authResponse: { user: AuthUser; accessToken: string; refreshToken: string }) => {
    const nextTokens = { accessToken: authResponse.accessToken, refreshToken: authResponse.refreshToken };
    await saveTokens(nextTokens);
    setTokens(nextTokens);
    setUser(authResponse.user);
    setErrorMessage(null);
  };

  const login = async (payload: LoginPayload): Promise<void> => {
    setLoginLoading(true);
    try {
      const result = await authApi.login(payload);
      await handleAuthSuccess(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to login');
      throw error;
    } finally {
      setLoginLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<void> => {
    setRegisterLoading(true);
    try {
      const result = await authApi.register(payload);
      await handleAuthSuccess(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to register');
      throw error;
    } finally {
      setRegisterLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout(tokens?.refreshToken);
    } finally {
      await clearTokens();
      setTokens(null);
      setUser(null);
      setErrorMessage(null);
    }
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      tokens,
      initializing,
      loginLoading,
      registerLoading,
      errorMessage,
      login,
      register,
      logout,
      clearError: () => setErrorMessage(null),
    }),
    [errorMessage, initializing, loginLoading, registerLoading, tokens, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
