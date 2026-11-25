/**
 * URL del panel del vendedor (inventario) según el entorno del backoffice, igual que getMarketBaseUrl:
 * - dev-backoffice (o dev.*) -> https://dev-inventario.repuestop.cl
 * - backoffice.repuestop.cl  -> https://inventario.repuestop.cl
 * - VITE_PANEL_URL, si está definida
 * - backoffice en localhost sin VITE_PANEL_URL -> el panel local (http://localhost:5175, puerto fijo del panel).
 *   Antes caía en producción, cuyo panel no conoce el ticket del invitado y mostraba el login.
 */
export const PANEL_LOCAL_URL = 'http://localhost:5175';

export function getPanelBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('dev-backoffice') || host.startsWith('dev.')) return 'https://dev-inventario.repuestop.cl';
    if (host.includes('backoffice.repuestop.cl')) return 'https://inventario.repuestop.cl';
  }
  const envUrl = (import.meta.env.VITE_PANEL_URL as string | undefined)?.replace(/\/+$/, '');
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return PANEL_LOCAL_URL;
  return 'https://inventario.repuestop.cl';
}

/** El ticket va en el hash (#), que el navegador no envía a ningún servidor ni deja en los registros. */
export function urlDeEntradaAlPanel(ticket: string): string {
  return `${getPanelBaseUrl()}/#ticket=${encodeURIComponent(ticket)}`;
}
