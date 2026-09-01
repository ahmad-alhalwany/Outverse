import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';
import type { User } from '../types';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  pending2FA: string | null;
  login: (usernameOrEmail: string, password: string) => Promise<{ requires_2fa: boolean }>;
  loginWithGoogle: () => Promise<{ requires_2fa: boolean }>;
  loginWithApple: () => Promise<{ requires_2fa: boolean }>;
  complete2FA: (code: string) => Promise<void>;
  clearPending2FA: () => void;
  register: (data: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }) => Promise<{ needs_verification?: boolean }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeUser(raw: any): User {
  const full = `${raw?.first_name || ''} ${raw?.last_name || ''}`.trim();
  return {
    id: raw?.id,
    username: raw?.username || '',
    email: raw?.email || '',
    display_name: raw?.display_name || full || raw?.username || '',
    first_name: raw?.first_name,
    last_name: raw?.last_name,
    bio: raw?.bio || '',
    location: raw?.location || '',
    avatar: raw?.avatar || undefined,
    cover_image: raw?.cover_photo || raw?.cover_image,
    cover_photo: raw?.cover_photo,
    followers_count: raw?.followers_count ?? 0,
    following_count: raw?.following_count ?? 0,
    posts_count: raw?.posts_count ?? 0,
    is_verified: !!raw?.is_verified || !!raw?.badge_verified,
    is_staff: !!raw?.is_staff || !!raw?.is_superuser,
    is_superuser: !!raw?.is_superuser,
    is_private: !!raw?.is_private,
    is_following: !!raw?.is_following,
    onboarding_completed: !!raw?.onboarding_completed,
    interests: raw?.interests || [],
    created_at: raw?.created_at,
    date_joined: raw?.date_joined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [pending2FA, setPending2FA] = useState<string | null>(null);

  const logoutLocal = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    setPending2FA(null);
  }, []);

  useEffect(() => {
    api.setUnauthorizedHandler(logoutLocal);
    return () => api.setUnauthorizedHandler(null);
  }, [logoutLocal]);

  const checkAuth = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) {
        setIsAuthenticated(false);
        setUser(null);
        return;
      }
      const me = await api.getMe();
      setUser(normalizeUser(me));
      setIsAuthenticated(true);
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('refresh_token');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    const result = await api.login(usernameOrEmail.trim(), password);
    if ('requires_2fa' in result && result.requires_2fa) {
      setPending2FA(result.pending_token);
      return { requires_2fa: true };
    }
    setPending2FA(null);
    setUser(normalizeUser((result as { user: Record<string, unknown> }).user));
    setIsAuthenticated(true);
    return { requires_2fa: false };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const { obtainGoogleIdToken } = await import('./googleSignIn');
    const idToken = await obtainGoogleIdToken();
    const result = await api.loginWithGoogle(idToken);
    if ('requires_2fa' in result && result.requires_2fa) {
      setPending2FA(result.pending_token);
      return { requires_2fa: true };
    }
    setPending2FA(null);
    setUser(normalizeUser((result as { user: Record<string, unknown> }).user));
    setIsAuthenticated(true);
    return { requires_2fa: false };
  }, []);

  const loginWithApple = useCallback(async () => {
    const { obtainAppleIdentityToken } = await import('./appleSignIn');
    const identityToken = await obtainAppleIdentityToken();
    const result = await api.loginWithApple(identityToken);
    if ('requires_2fa' in result && result.requires_2fa) {
      setPending2FA(result.pending_token);
      return { requires_2fa: true };
    }
    setPending2FA(null);
    setUser(normalizeUser((result as { user: Record<string, unknown> }).user));
    setIsAuthenticated(true);
    return { requires_2fa: false };
  }, []);

  const complete2FA = useCallback(async (code: string) => {
    if (!pending2FA) throw new Error('No pending 2FA session.');
    const result = await api.completeTwoFactorLogin(pending2FA, code.trim());
    setPending2FA(null);
    setUser(normalizeUser(result.user));
    setIsAuthenticated(true);
  }, [pending2FA]);

  const clearPending2FA = useCallback(() => setPending2FA(null), []);

  const register = useCallback(
    async (data: {
      username: string;
      email: string;
      password: string;
      first_name?: string;
      last_name?: string;
    }) => {
      const res = await api.register(data);
      if (res?.token && res?.user) {
        setUser(normalizeUser(res.user));
        setIsAuthenticated(true);
        return {};
      }
      // Typical path: email verification required before login.
      return { needs_verification: true };
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.logout();
    logoutLocal();
  }, [logoutLocal]);

  const updateUser = useCallback((updated: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updated } : prev));
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        user,
        pending2FA,
        login,
        loginWithGoogle,
        loginWithApple,
        complete2FA,
        clearPending2FA,
        register,
        logout,
        checkAuth,
        updateUser,
      }}
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

export default AuthContext;
