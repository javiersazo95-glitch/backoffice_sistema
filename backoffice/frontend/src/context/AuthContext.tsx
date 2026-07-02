import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserSummaryResponse } from '@/types/auth';
import { Role } from '@/types/auth';
import apiClient from '@/api/client';

interface BackofficeUserResponse {
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

interface BackofficeLoginResponse {
  token?: string;
  accessToken?: string;
  usuario?: BackofficeUserResponse;
  user?: UserSummaryResponse;
}

interface AuthState {
  user: UserSummaryResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string, keepSession?: boolean) => Promise<void>;
  loginWithGoogle: (idToken: string, keepSession?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ACCESS_TOKEN_STORAGE_KEY = 'repuestop.backoffice.access-token';

function mapRole(role: string) {
  const normalizedRole = role.toUpperCase();
  if (normalizedRole === Role.SUPER_ADMIN) return Role.SUPER_ADMIN;
  if (normalizedRole === Role.ADMIN) return Role.ADMIN;
  return Role.OPERATOR;
}

function mapUser(response: BackofficeLoginResponse): UserSummaryResponse | null {
  if (response.user) {
    return response.user;
  }

  if (!response.usuario) {
    return null;
  }

  const { usuario } = response;
  return {
    id: usuario.id,
    username: usuario.email,
    fullName: usuario.nombre,
    initials: usuario.nombre.substring(0, 2).toUpperCase(),
    role: mapRole(usuario.rol),
  };
}

function mapCurrentUser(response: UserSummaryResponse | BackofficeUserResponse): UserSummaryResponse {
  if ('fullName' in response) {
    return {
      ...response,
      role: mapRole(response.role),
    };
  }

  return {
    id: response.id,
    username: response.email,
    fullName: response.nombre,
    initials: response.nombre.substring(0, 2).toUpperCase(),
    role: mapRole(response.rol),
  };
}

function setAuthHeader(token: string) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

function clearAuthHeader() {
  delete apiClient.defaults.headers.common['Authorization'];
}

function getStoredToken() {
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function storeToken(token: string, keepSession = false) {
  const primaryStorage = keepSession ? localStorage : sessionStorage;
  const secondaryStorage = keepSession ? sessionStorage : localStorage;
  secondaryStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  primaryStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

function clearStoredToken() {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    async function restoreSession() {
      const token = getStoredToken();

      if (!token) {
        setState((current) => ({ ...current, isLoading: false }));
        return;
      }

      setAuthHeader(token);

      try {
        const response = await apiClient.get<UserSummaryResponse | BackofficeUserResponse>('/auth/me');
        setState({
          user: mapCurrentUser(response.data),
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (error) {
        clearStoredToken();
        clearAuthHeader();
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    }
    void restoreSession();
  }, []);

  const login = useCallback(async (username: string, password: string, keepSession = false) => {
    const response = await apiClient.post<BackofficeLoginResponse>('/auth/login', {
      email: username.trim(),
      password,
      authProvider: 'EMAIL_PASSWORD',
    });

    const token = response.data.token ?? response.data.accessToken;
    const user = mapUser(response.data);

    if (!token || !user) {
      throw new Error('Respuesta de autenticación inválida');
    }

    storeToken(token, keepSession);
    setAuthHeader(token);
    const currentUser = await apiClient.get<UserSummaryResponse | BackofficeUserResponse>('/auth/me');
    setState({
      user: mapCurrentUser(currentUser.data),
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string, keepSession = false) => {
    const response = await apiClient.post<BackofficeLoginResponse>('/auth/google', { idToken });

    const token = response.data.token ?? response.data.accessToken;
    const user = mapUser(response.data);

    if (!token || !user) {
      throw new Error('Respuesta de autenticación inválida');
    }

    storeToken(token, keepSession);
    setAuthHeader(token);
    const currentUser = await apiClient.get<UserSummaryResponse | BackofficeUserResponse>('/auth/me');
    setState({
      user: mapCurrentUser(currentUser.data),
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(async () => {
    clearStoredToken();
    clearAuthHeader();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const refresh = useCallback(async () => {}, []);

  if (state.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', fontFamily: 'sans-serif', color: '#64748b' }}>
        <div>Cargando sesión administrativa...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...state, login, loginWithGoogle, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
