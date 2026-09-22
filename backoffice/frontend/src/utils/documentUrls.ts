import { API_BASE_URL, API_ORIGIN } from '@/api/client';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/html': 'html',
};

/**
 * ¿Esta URL la sirve nuestro propio backend?
 *
 * Importa porque las credenciales de la sesion solo deben viajar al backend. Las URLs de
 * documentos y fotos llegan dentro de registros que originan terceros (adjuntos de tickets,
 * documentos de vendedores, evidencias de mediacion), asi que una URL absoluta a un host ajeno
 * es una posibilidad real, no teorica: mandarle la cookie de sesion entregaria la sesion
 * administrativa a ese host.
 *
 * Reglas: una ruta relativa siempre es nuestra; una absoluta solo si su origen coincide con el
 * backend configurado. Cuando no hay VITE_API_URL (desarrollo, donde el proxy de Vite sirve
 * /api/v1 en el mismo origen) se compara contra el origen de la propia pagina. data: y blob:
 * no salen a la red, asi que no necesitan credenciales.
 */
export function isBackendUrl(url: string): boolean {
  if (!url || /^(data|blob):/i.test(url)) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;

  const backendOrigin = API_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!backendOrigin) return false;

  try {
    return new URL(url, backendOrigin).origin === backendOrigin;
  } catch {
    return false;
  }
}

/**
 * Opciones de fetch para descargar un fichero del backend.
 *
 * La sesion viaja en la cookie HttpOnly rt_session, asi que aqui no se construye ninguna
 * cabecera: basta con pedirle al navegador que incluya credenciales. Y solo se le pide para
 * URLs de nuestro backend, porque las de documentos y fotos llegan dentro de registros que
 * originan terceros (adjuntos de tickets, documentos de vendedores, evidencias de mediacion) y
 * una URL absoluta a un host ajeno es una posibilidad real: mandarle las credenciales seria
 * entregarle la sesion administrativa.
 *
 * Antes esto adjuntaba un Bearer leido de localStorage. Ese almacenamiento desaparecio con
 * SEC-BACKOFFICE-006; la regla de origen es la misma y sigue viviendo en isBackendUrl.
 */
export function fetchOptionsFor(url: string): RequestInit {
  return { credentials: isBackendUrl(url) ? 'include' : 'omit' };
}

/**
 * URL de un documento apta para poner en un href o para abrir en una pestana nueva, o undefined
 * si el documento no lo sirve nuestro backend.
 *
 * resolveDocumentUrl() se limita a normalizar y devuelve intacta cualquier URL absoluta, incluida
 * una de un host ajeno. Navegar ahi desde la consola administrativa es una redireccion abierta:
 * la pestana se abre con la confianza del backoffice detras. Quien vaya a NAVEGAR usa esta
 * funcion; quien solo vaya a descargar con fetch puede seguir usando resolveDocumentUrl, porque
 * fetchOptionsFor ya impide que las credenciales salgan del backend.
 */
export function resolveNavigableDocumentUrl(documentUrl?: string): string | undefined {
  const resolved = resolveDocumentUrl(documentUrl);
  if (!resolved || !isBackendUrl(resolved)) return undefined;
  return resolved;
}

function getAbsoluteApiBaseUrl() {
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    return new URL(API_BASE_URL, window.location.origin).href;
  }

  return API_BASE_URL;
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]+/g, '')
    .replace(/\s+/g, '_');
}

function getUrlExtension(url?: string) {
  if (!url) return '';

  try {
    const pathname = new URL(resolveDocumentUrl(url) ?? url, getAbsoluteApiBaseUrl()).pathname;
    return pathname.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? '';
  } catch {
    return url.split('?')[0]?.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? '';
  }
}

function getMimeExtension(mimeType?: string) {
  return mimeType ? MIME_EXTENSION_MAP[mimeType.toLowerCase()] ?? '' : '';
}

export function resolveDocumentUrl(documentUrl?: string) {
  if (!documentUrl) return undefined;

  try {
    const url = new URL(documentUrl, getAbsoluteApiBaseUrl());
    const isLocalBackend = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

    if (isLocalBackend && typeof window !== 'undefined' && url.origin !== window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return url.href;
  } catch {
    return documentUrl;
  }
}

export function buildDocumentDownloadName(documentType: string, documentUrl?: string, mimeType?: string) {
  const normalized = sanitizeFileName(documentType);
  const extension = getUrlExtension(documentUrl) || getMimeExtension(mimeType);
  return `${normalized || 'documento'}${extension ? `.${extension}` : ''}`;
}

export function getDocumentFileName(documentUrl?: string, fallback = 'documento') {
  if (!documentUrl) return fallback;

  try {
    const url = new URL(resolveDocumentUrl(documentUrl) ?? documentUrl, getAbsoluteApiBaseUrl());
    const explicitName = url.searchParams.get('filename');
    if (explicitName) return explicitName;

    const lastSegment = decodeURIComponent(url.pathname.split('/').pop() || '');
    return lastSegment.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '') || fallback;
  } catch {
    const lastSegment = documentUrl.split('?')[0]?.split('/').pop() || '';
    return lastSegment.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '') || fallback;
  }
}

export async function downloadDocument(documentUrl?: string, fileName = 'documento') {
  const resolvedUrl = resolveDocumentUrl(documentUrl);
  if (!resolvedUrl) return false;

  try {
    const response = await fetch(resolvedUrl, fetchOptionsFor(resolvedUrl));
    if (!response.ok) throw new Error('No se pudo descargar el documento.');

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    return true;
  } catch {
    // Plan B: dejar que el navegador descargue por su cuenta. Solo si el documento lo sirve
    // nuestro backend; con una URL de otro host esto seria navegar a donde diga un tercero.
    if (!isBackendUrl(resolvedUrl)) return false;

    const link = window.document.createElement('a');
    link.href = resolvedUrl;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noreferrer';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    return false;
  }
}

export async function previewDocument(documentUrl?: string) {
  const resolvedUrl = resolveDocumentUrl(documentUrl);
  if (!resolvedUrl) return false;

  const win = window.open('about:blank', '_blank');

  try {
    const response = await fetch(resolvedUrl, fetchOptionsFor(resolvedUrl));

    if (!response.ok) {
      if (win) win.close();
      throw new Error(`Error ${response.status} al cargar el documento.`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    if (win) {
      win.location.href = blobUrl;
    } else {
      window.open(blobUrl, '_blank');
    }
    return true;
  } catch (err) {
    if (win && !win.closed) {
      win.close();
    }
    console.error('Error al previsualizar documento:', err);
    // Plan B: abrir el documento directo. Solo si lo sirve nuestro backend; abrir una URL de
    // otro host desde la consola administrativa es una redireccion abierta.
    if (isBackendUrl(resolvedUrl)) {
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    }
    return false;
  }
}

