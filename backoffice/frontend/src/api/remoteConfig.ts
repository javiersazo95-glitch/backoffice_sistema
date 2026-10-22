import apiClient from './client';
import type { BootstrapDTO, ClienteConfig, ConfigVersionDTO } from '@/types/remoteConfig';

/**
 * Endpoints públicos del Mantenedor común (contrato, sección 1). No piden autenticación; si el
 * backend todavía no los expone responden 404 y el store sigue con la caché o los fallbacks.
 *
 * Se copia a Backoffice_movil (`sync:web`), por eso no toca el DOM y usa el `apiClient` del
 * repo (en la app se sustituye por el shim de `@/platform/client`).
 */

export type BootstrapResult =
  /** Config nueva: reemplazar la que se tenía y guardarla en caché. */
  | { status: 200; data: BootstrapDTO; etag: string | null }
  /** `If-None-Match` coincidió: lo que se tiene sigue vigente. */
  | { status: 304 };

/**
 * Pide el bootstrap con revalidación por ETag. Axios rechaza por defecto todo lo que no sea 2xx,
 * y el 304 es una respuesta esperada (no un error), así que se acepta explícitamente.
 */
export async function fetchBootstrap(cliente: ClienteConfig, etag?: string | null): Promise<BootstrapResult> {
  const response = await apiClient.get<BootstrapDTO | ''>('/config/bootstrap', {
    params: { cliente },
    headers: etag ? { 'If-None-Match': etag } : undefined,
    validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
  });

  if (response.status === 304 || !response.data || typeof response.data !== 'object') {
    return { status: 304 };
  }

  const etagRecibido = response.headers?.etag ?? response.headers?.ETag ?? null;
  return { status: 200, data: response.data, etag: typeof etagRecibido === 'string' ? etagRecibido : null };
}

/** Versión global de la configuración; si difiere de la que se tiene, se vuelve a pedir el bootstrap. */
export async function fetchConfigVersion(): Promise<number> {
  const { data } = await apiClient.get<ConfigVersionDTO>('/config/version');
  return data.version;
}
