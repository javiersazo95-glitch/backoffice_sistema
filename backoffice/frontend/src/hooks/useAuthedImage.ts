import { useEffect, useMemo, useState } from 'react';
import { resolveProfileImageUrl } from '@/api/client';
import { fetchOptionsFor, isBackendUrl } from '@/utils/documentUrls';

/**
 * Las fotos privadas del backend (proxy /api/v1/uploads/r2/**) solo se sirven a peticiones con
 * la sesion del backoffice, y una etiqueta <img> no envia credenciales entre origenes: sale
 * anonima y el backend responde 401. Este hook descarga la imagen con fetch + cookie de sesion y
 * entrega un blob: URL, el mismo patron que ya usa utils/documentUrls para los documentos.
 *
 * Si la descarga autenticada falla se cae a la URL directa: las carpetas publicas por diseno
 * (Productos/, Perfiles/, Publicidad/) siguen cargando aunque no haya sesion valida.
 */

const MAX_CACHED_IMAGES = 200;

// URL resuelta -> blob: URL ya descargada. Evita re-descargar la misma foto en cada render
// de la tabla y al abrir el detalle o la vista ampliada del mismo anuncio.
const objectUrlCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string>>();
// URLs cuya descarga autenticada ya fallo (CORS, 401, 404): se pintan directo con <img> y no
// se reintenta el fetch en cada render de la tabla.
const failedUrls = new Set<string>();

function rememberObjectUrl(url: string, objectUrl: string) {
  objectUrlCache.set(url, objectUrl);
  while (objectUrlCache.size > MAX_CACHED_IMAGES) {
    const oldest = objectUrlCache.keys().next();
    if (oldest.done) break;
    const staleObjectUrl = objectUrlCache.get(oldest.value);
    objectUrlCache.delete(oldest.value);
    if (staleObjectUrl) URL.revokeObjectURL(staleObjectUrl);
  }
}

function requiereSesionDelBackoffice(url: string) {
  if (failedUrls.has(url)) return false;
  // La comprobacion de origen vive en utils/documentUrls (isBackendUrl) para que este hook y
  // los sinks de documentos apliquen exactamente la misma regla. Tambien descarta data: y blob:.
  // Ya no se comprueba antes si hay token: la cookie de sesion es HttpOnly y no se puede leer
  // desde aqui, asi que se intenta la descarga y el cache de fallos evita reintentos inutiles.
  return isBackendUrl(url);
}

async function downloadAsObjectUrl(url: string): Promise<string> {
  const pending = inFlightRequests.get(url);
  if (pending) return pending;

  const request = (async () => {
    const response = await fetch(url, fetchOptionsFor(url));
    if (!response.ok) throw new Error(`Error ${response.status} al cargar la imagen.`);

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    rememberObjectUrl(url, objectUrl);
    return objectUrl;
  })().finally(() => {
    inFlightRequests.delete(url);
  });

  inFlightRequests.set(url, request);
  return request;
}

export function useAuthedImage(rawUrl?: string | null): string | null {
  const resolvedUrl = useMemo(() => resolveProfileImageUrl(rawUrl), [rawUrl]);

  const [src, setSrc] = useState<string | null>(() => {
    if (!resolvedUrl) return null;
    if (!requiereSesionDelBackoffice(resolvedUrl)) return resolvedUrl;
    return objectUrlCache.get(resolvedUrl) ?? null;
  });

  useEffect(() => {
    if (!resolvedUrl) {
      setSrc(null);
      return;
    }

    if (!requiereSesionDelBackoffice(resolvedUrl)) {
      setSrc(resolvedUrl);
      return;
    }

    const cached = objectUrlCache.get(resolvedUrl);
    if (cached) {
      setSrc(cached);
      return;
    }

    let active = true;
    setSrc(null);

    downloadAsObjectUrl(resolvedUrl)
      .then((objectUrl) => {
        if (active) setSrc(objectUrl);
      })
      .catch(() => {
        failedUrls.add(resolvedUrl);
        if (active) setSrc(resolvedUrl);
      });

    return () => {
      active = false;
    };
  }, [resolvedUrl]);

  return src;
}

export default useAuthedImage;
