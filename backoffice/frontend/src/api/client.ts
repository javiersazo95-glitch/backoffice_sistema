import axios from 'axios';
import type { AxiosInstance } from 'axios';

export const normalizeApiBaseUrl = (baseUrl?: string) => {
  const trimmedBaseUrl = baseUrl?.replace(/\/+$/, '');

  if (!trimmedBaseUrl) {
    return '/api/v1';
  }

  return trimmedBaseUrl.endsWith('/api/v1')
    ? trimmedBaseUrl
    : trimmedBaseUrl.endsWith('/api')
      ? `${trimmedBaseUrl}/v1`
    : `${trimmedBaseUrl}/api/v1`;
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

const getApiOrigin = () => {
  const configuredBase = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') ?? '';
  return configuredBase.replace(/\/api\/v1$/i, '').replace(/\/api$/i, '');
};

// Origen del backend (sin el sufijo /api o /api/v1). Se expone para que quien necesite
// descargar un archivo del backend con el token del backoffice pueda distinguir las URLs
// propias de las externas (ver hooks/useAuthedImage).
export const API_ORIGIN = getApiOrigin();

// Rutas del proxy de archivos del backend. Solo estas se re-apuntan al backend configurado:
// una URL externa (Unsplash, avatares de Google, etc.) se deja intacta.
const BACKEND_UPLOADS_PATH = /\/api\/v1\/uploads\//i;

/**
 * Algunos registros guardan la URL ABSOLUTA del backend que subio el archivo (la app movil
 * persiste el resultado de resolveImageUri, ver mobile/utils/images.ts), asi que una foto
 * cargada desde un backend local o de otro ambiente queda apuntando a ese host: en el
 * backoffice publicado eso es una imagen rota, y si el host guardado es http:// el navegador
 * ademas la bloquea por contenido mixto. Se reescribe al backend configurado en esta build,
 * que es el unico que puede servir ese archivo.
 */
const rewriteToApiOrigin = (absoluteUrl: string): string => {
  const apiOrigin = getApiOrigin();
  if (!apiOrigin) return absoluteUrl;

  try {
    const url = new URL(absoluteUrl);
    if (!BACKEND_UPLOADS_PATH.test(url.pathname)) return absoluteUrl;
    if (url.origin === apiOrigin) return absoluteUrl;
    return `${apiOrigin}${url.pathname}${url.search}`;
  } catch {
    return absoluteUrl;
  }
};

export const resolveProfileImageUrl = (...candidates: Array<string | null | undefined>): string | null => {
  const rawUrl = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)?.trim();
  if (!rawUrl) return null;
  if (/^https?:\/\//i.test(rawUrl)) return rewriteToApiOrigin(rawUrl);
  if (/^(data|blob):/i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('//')) return `https:${rawUrl}`;

  const apiOrigin = getApiOrigin();

  if (rawUrl.startsWith('/api/v1/')) return `${apiOrigin}${rawUrl}`;
  if (rawUrl.startsWith('api/v1/')) return `${apiOrigin}/${rawUrl}`;
  if (rawUrl.startsWith('/uploads/')) return `${apiOrigin}/api/v1${rawUrl}`;
  if (rawUrl.startsWith('uploads/')) return `${apiOrigin}/api/v1/${rawUrl}`;
  if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) return `${apiOrigin}${rawUrl}`;

  return `${apiOrigin}/api/v1/uploads/r2/${rawUrl.replace(/^\/+/, '')}`;
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Rutas donde un 401 es la respuesta normal, no una sesion caducada.
 *
 * En todas ellas el 401 significa "estas credenciales no sirven" y lo gestiona la pantalla que
 * hizo la llamada. Tratarlo como expiracion de sesion provocaria un cierre de sesion en cada
 * intento de acceso fallido.
 */
const RUTAS_DE_SESION = [
  '/auth/login',
  '/auth/google',
  '/auth/backoffice/login',
  '/auth/backoffice/google',
  '/auth/refresh',
  '/auth/logout',
];

type ManejadorDeSesionCaducada = () => void;

let alCaducarSesion: ManejadorDeSesionCaducada | null = null;

/**
 * Registra que hacer cuando el backend responde 401 con una sesion que se creia valida.
 *
 * Existe este registro en vez de una llamada directa porque quien sabe cerrar la sesion es
 * AuthContext, y AuthContext ya importa este modulo: llamarlo desde aqui crearia un ciclo.
 * AuthProvider se registra al montar y se da de baja al desmontar.
 */
export function registrarManejadorDeSesionCaducada(handler: ManejadorDeSesionCaducada | null) {
  alCaducarSesion = handler;
}

/**
 * Un 401 inesperado significa que el token caduco o fue revocado.
 *
 * Sin esto, cada consulta fallaba por separado y la aplicacion seguia mostrandose como
 * autenticada con los datos que react-query ya tenia en cache: el operador veia una pantalla
 * viva, con informacion que ya no podia refrescar, y podia decidir sobre ella.
 *
 * El interceptor solo avisa y deja pasar el error: cada pantalla sigue gestionando su propio
 * fallo como hasta ahora.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = typeof error?.config?.url === 'string' ? error.config.url : '';

    if (status === 401 && !RUTAS_DE_SESION.some((ruta) => url.startsWith(ruta))) {
      alCaducarSesion?.();
    }

    return Promise.reject(error);
  },
);

export default apiClient;
