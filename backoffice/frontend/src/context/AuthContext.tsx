import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { BackofficePermission, UserSummaryResponse } from '@/types/auth';
import { Role } from '@/types/auth';
import apiClient from '@/api/client';

interface BackofficeUserResponse {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  /**
   * El backend puede acompanar la respuesta en castellano con la lista de permisos por area.
   * Se declara para no descartarla al mapear: hasBackofficePermission solo consulta la lista si
   * llega, y si falta cae a un fallback por rol mucho mas amplio (ver SEC-BACKOFFICE-002).
   */
  permissions?: BackofficePermission[];
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
  login: (username: string, password: string, keepSession?: boolean, loginContext?: 'BACKOFFICE' | 'CAPTADOR') => Promise<UserSummaryResponse>;
  loginWithGoogle: (idToken: string, keepSession?: boolean, loginContext?: 'BACKOFFICE' | 'CAPTADOR') => Promise<UserSummaryResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ACCESS_TOKEN_STORAGE_KEY = 'repuestop.backoffice.access-token';

function mapRole(role: string) {
  const normalizedRole = role.toUpperCase();
  if (normalizedRole === Role.SUPER_ADMIN) return Role.SUPER_ADMIN;
  if (normalizedRole === Role.ADMIN) return Role.ADMIN;
  if (normalizedRole === Role.CAPTADOR) return Role.CAPTADOR;
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
    // Se propaga tal cual: si el backend la envia, la decision de permisos pasa a basarse en la
    // lista explicita en vez del fallback por rol. Si no la envia, queda undefined y el
    // comportamiento es el de antes.
    permissions: response.permissions,
  };
}

function setAuthHeader(token: string) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

function clearAuthHeader() {
  delete apiClient.defaults.headers.common['Authorization'];
}

function getStoredToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
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

  const login = useCallback(async (username: string, password: string, keepSession = false, loginContext: 'BACKOFFICE' | 'CAPTADOR' = 'BACKOFFICE') => {
    const response = await apiClient.post<BackofficeLoginResponse>(loginContext === 'BACKOFFICE' ? '/auth/backoffice/login' : '/auth/login', {
      email: username.trim(),
      password,
      authProvider: 'EMAIL_PASSWORD',
      loginContext,
    });

    const token = response.data.token ?? response.data.accessToken;
    const user = mapUser(response.data);

    if (!token || !user) {
      throw new Error('Respuesta de autenticación inválida');
    }

    storeToken(token, keepSession);
    setAuthHeader(token);
    const currentUser = await apiClient.get<UserSummaryResponse | BackofficeUserResponse>('/auth/me');
    const mapped = mapCurrentUser(currentUser.data);
    setState({
      user: mapped,
      isAuthenticated: true,
      isLoading: false,
    });
    return mapped;
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string, keepSession = false, loginContext: 'BACKOFFICE' | 'CAPTADOR' = 'BACKOFFICE') => {
    const response = await apiClient.post<BackofficeLoginResponse>(loginContext === 'BACKOFFICE' ? '/auth/backoffice/google' : '/auth/google', { idToken, loginContext });

    const token = response.data.token ?? response.data.accessToken;
    const user = mapUser(response.data);

    if (!token || !user) {
      throw new Error('Respuesta de autenticación inválida');
    }

    storeToken(token, keepSession);
    setAuthHeader(token);
    const currentUser = await apiClient.get<UserSummaryResponse | BackofficeUserResponse>('/auth/me');
    const mapped = mapCurrentUser(currentUser.data);
    setState({
      user: mapped,
      isAuthenticated: true,
      isLoading: false,
    });
    return mapped;
  }, []);

  /**
   * Cierra la sesion. Avisa primero al backend para que revoque el token y despues limpia el
   * estado local.
   *
   * El aviso al servidor importa: sin el, el token seguia siendo valido hasta expirar, asi que
   * cualquier copia extraida antes sobrevivia al "cerrar sesion". La llamada va primero porque
   * necesita la cabecera Authorization todavia puesta.
   *
   * Es best-effort a proposito: si la red falla o el backend responde error, la sesion local se
   * cierra igual. Dejar al usuario dentro porque el servidor no contesto seria peor que no
   * revocar. Se omite la llamada cuando no hay token guardado, porque LoginPage invoca logout()
   * antes de cada intento de acceso para partir de una sesion limpia.
   */
  const logout = useCallback(async () => {
    const hadToken = Boolean(getStoredToken());

    if (hadToken) {
      try {
        await apiClient.post('/auth/logout');
      } catch {
        // Revocacion no confirmada; se continua con el cierre local de todos modos.
      }
    }

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
