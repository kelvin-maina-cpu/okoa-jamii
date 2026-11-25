import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { AuthTokens, AuthUser, LoginPayload, RegisterPayload } from '../types/auth';
import * as authApi from '../services/authApi';
import { ApiError } from '../services/apiClient';
import { clearTokens, loadCachedUser, loadTokens, saveCachedUser, saveTokens } from '../services/secureAuthStorage';

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
  refreshSession: () => Promise<void>;
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
  const refreshingSession = useRef(false);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const persistedTokens = await loadTokens();
        if (!persistedTokens) return;
        const cachedUser = await loadCachedUser();

        try {
          const profile = await authApi.me(persistedTokens.accessToken);
          await saveCachedUser(profile.user);
          setUser(profile.user);
          setTokens(persistedTokens);
          return;
        } catch (initialError) {
          try {
            const refreshed = await authApi.refresh(persistedTokens.refreshToken);
            const refreshedTokens = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
            await saveTokens(refreshedTokens);
            setTokens(refreshedTokens);
            const profile = await authApi.me(refreshed.accessToken);
            await saveCachedUser(profile.user);
            setUser(profile.user);
            setTokens(refreshedTokens);
          } catch (refreshError) {
            const unavailable = (error: unknown) => error instanceof TypeError || (error instanceof ApiError && error.statusCode >= 500);
            if (cachedUser && (unavailable(initialError) || unavailable(refreshError))) {
              const fallbackTokens = await loadTokens() ?? persistedTokens;
              setUser(cachedUser);
              setTokens(fallbackTokens);
              setErrorMessage('Offline mode: saved reports remain available and will sync when the server is reachable.');
              return;
            }
            throw refreshError;
          }
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
    await Promise.all([saveTokens(nextTokens), saveCachedUser(authResponse.user)]);
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

  const refreshSession = async (): Promise<void> => {
    if (!tokens || refreshingSession.current) return;
    refreshingSession.current = true;
    try {
      try {
        const profile = await authApi.me(tokens.accessToken);
        await saveCachedUser(profile.user);
        setUser(profile.user);
        setErrorMessage(null);
      } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 401) {
          if (error instanceof ApiError && error.statusCode < 500) throw error;
          // Network/server outages preserve the cached authenticated session for the offline queue.
          return;
        }
        try {
          const refreshed = await authApi.refresh(tokens.refreshToken);
          const nextTokens = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
          await saveTokens(nextTokens);
          setTokens(nextTokens);
          const profile = await authApi.me(refreshed.accessToken);
          await saveCachedUser(profile.user);
          setUser(profile.user);
          setErrorMessage(null);
        } catch (refreshError) {
          if (refreshError instanceof ApiError && refreshError.statusCode === 401) {
            await clearTokens(); setTokens(null); setUser(null);
            setErrorMessage('Your session expired. Sign in again to send saved reports.');
            return;
          }
          throw refreshError;
        }
      }
    } finally {
      refreshingSession.current = false;
    }
  };

  useEffect(() => {
    if (!tokens) return;
    // Keep the default 15-minute access token fresh while the app remains foregrounded.
    const refreshTimer = setTimeout(() => { void refreshSession().catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Session refresh failed.')); }, 10 * 60 * 1000);
    const refreshIfConnected = () => { void refreshSession().catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Session refresh failed.')); };
    const network = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) refreshIfConnected();
    });
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') refreshIfConnected(); });
    return () => { clearTimeout(refreshTimer); network.remove(); appState.remove(); };
  }, [tokens]);

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
      refreshSession,
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
