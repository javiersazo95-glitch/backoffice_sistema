import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BackofficePermission, UserSummaryResponse } from '@/types/auth';
import { Role } from '@/types/auth';
import apiClient, { registrarManejadorDeSesionCaducada } from '@/api/client';
import { showToast } from '@/components/layout/Toast';

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
  login: (username: string, password: string, loginContext?: 'BACKOFFICE' | 'CAPTADOR') => Promise<UserSummaryResponse>;
  loginWithGoogle: (idToken: string, loginContext?: 'BACKOFFICE' | 'CAPTADOR') => Promise<UserSummaryResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * La sesion vive en la cookie rt_session que emite el backend (HttpOnly, Secure, SameSite=Lax).
 *
 * Antes el token se guardaba en sessionStorage o, con "mantener sesion", en localStorage, donde
 * cualquier script del origen podia leerlo de una sola linea. En una consola administrativa eso
 * convertia cualquier ejecucion de script en robo de una sesion privilegiada. Ahora el navegador
 * envia la cookie sola --apiClient ya va con withCredentials-- y JavaScript no puede leerla.
 *
 * Consecuencias de las que depende el resto del archivo:
 * - No hay nada que guardar ni que limpiar en el cliente: cerrar sesion es cosa del servidor.
 * - Al arrancar no se puede saber si hay sesion mirando el almacenamiento; se pregunta a
 *   /auth/me, que respondera 200 si la cookie es valida y 401 si no.
 * - La cookie dura 8 horas fijas, asi que ya no existe un "mantener sesion" mas largo.
 */
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Espejo del estado de sesion. Permite consultarlo desde el manejador de 401 sin volver a
  // registrarlo en cada cambio, y sin meter efectos secundarios dentro de un updater de
  // setState (React los invoca dos veces en StrictMode y el aviso saldria duplicado).
  const estaAutenticadoRef = useRef(false);

  useEffect(() => {
    estaAutenticadoRef.current = state.isAuthenticated;
  }, [state.isAuthenticated]);

  /**
   * Cierra la sesion cuando el backend responde 401 con un token que se creia valido.
   *
   * Vacia tambien la cache de react-query: si no, los datos ya descargados seguirian
   * pintandose bajo la pantalla de acceso y podrian reaparecer al volver a entrar con otra
   * cuenta. Al quedar isAuthenticated en false, las guardas de ruta llevan a /login solas.
   */
  useEffect(() => {
    registrarManejadorDeSesionCaducada(() => {
      // Varias consultas pueden fallar con 401 a la vez: solo la primera cierra la sesion.
      if (!estaAutenticadoRef.current) return;
      estaAutenticadoRef.current = false;

      // No hay nada que limpiar en el cliente: la cookie la invalida el servidor. Solo se vacia
      // la cache, para que los datos ya descargados no sigan pintandose bajo la pantalla de
      // acceso ni reaparezcan al entrar con otra cuenta.
      queryClient.clear();
      setState({ user: null, isAuthenticated: false, isLoading: false });
      showToast('Tu sesión expiró. Vuelve a iniciar sesión.');
    });

    return () => registrarManejadorDeSesionCaducada(null);
  }, [queryClient]);

  /**
   * Recupera la sesion al arrancar preguntando al servidor.
   *
   * Con la cookie HttpOnly el cliente no puede inspeccionar si hay sesion: la unica forma de
   * saberlo es intentar. Un 401 aqui es la respuesta normal de quien no ha entrado todavia, no
   * un error: por eso se resuelve en silencio y no pasa por el aviso de sesion caducada.
   */
  useEffect(() => {
    async function restoreSession() {
      try {
        const response = await apiClient.get<UserSummaryResponse | BackofficeUserResponse>('/auth/me');
        setState({
          user: mapCurrentUser(response.data),
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    }
    void restoreSession();
  }, []);

  const login = useCallback(async (username: string, password: string, loginContext: 'BACKOFFICE' | 'CAPTADOR' = 'BACKOFFICE') => {
    const response = await apiClient.post<BackofficeLoginResponse>(loginContext === 'BACKOFFICE' ? '/auth/backoffice/login' : '/auth/login', {
      email: username.trim(),
      password,
      authProvider: 'EMAIL_PASSWORD',
      loginContext,
    });

    // La respuesta trae la cookie de sesion; del cuerpo solo se comprueba que identifique a
    // alguien. El token que el backend aun devuelve por compatibilidad se ignora a proposito:
    // guardarlo reabriria SEC-BACKOFFICE-006.
    if (!mapUser(response.data)) {
      throw new Error('Respuesta de autenticación inválida');
    }

    const currentUser = await apiClient.get<UserSummaryResponse | BackofficeUserResponse>('/auth/me');
    const mapped = mapCurrentUser(currentUser.data);
    setState({
      user: mapped,
      isAuthenticated: true,
      isLoading: false,
    });
    return mapped;
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string, loginContext: 'BACKOFFICE' | 'CAPTADOR' = 'BACKOFFICE') => {
    const response = await apiClient.post<BackofficeLoginResponse>(loginContext === 'BACKOFFICE' ? '/auth/backoffice/google' : '/auth/google', { idToken, loginContext });

    // La respuesta trae la cookie de sesion; del cuerpo solo se comprueba que identifique a
    // alguien. El token que el backend aun devuelve por compatibilidad se ignora a proposito:
    // guardarlo reabriria SEC-BACKOFFICE-006.
    if (!mapUser(response.data)) {
      throw new Error('Respuesta de autenticación inválida');
    }

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
   * Cierra la sesion en el servidor, que revoca el token y caduca la cookie.
   *
   * Es best-effort: si la red falla o el backend responde error, el estado local se limpia
   * igual. Dejar al usuario dentro porque el servidor no contesto seria peor que no revocar.
   * Ya no se puede comprobar antes si "habia sesion": la cookie es HttpOnly y no se lee desde
   * JavaScript, asi que la llamada sale siempre. Es barata y el servidor la ignora si no hay
   * nada que revocar.
   */
  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Revocacion no confirmada; se continua con el cierre local de todos modos.
    }

    queryClient.clear();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, [queryClient]);

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
