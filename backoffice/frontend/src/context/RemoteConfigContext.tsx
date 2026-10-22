import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchBootstrap, fetchConfigVersion } from '@/api/remoteConfig';
import { remoteConfig } from '@/utils/remoteConfigStore';

/**
 * Alimenta el store de configuración remota (`utils/remoteConfigStore`) siguiendo el contrato del
 * Mantenedor común, sección 6:
 *
 * 1. Al montar lee la caché de `localStorage` (clave `repuestop.remote-config.BACKOFFICE.v1`) y
 *    en paralelo pide `GET /config/bootstrap?cliente=BACKOFFICE` con `If-None-Match`.
 * 2. Si la red falla reintenta con backoff 1 s / 5 s / 30 s y después se rinde hasta el próximo
 *    foco o tick: mientras el backend no exponga el endpoint, un 404 tres veces y silencio.
 * 3. Al volver a foco y cada 5 minutos consulta `GET /config/version`; si difiere, re-pide.
 *
 * Nunca bloquea el render: los hijos se pintan de inmediato con la caché o con los fallbacks, y
 * los hooks de `hooks/useRemoteConfig` se re-pintan solos cuando llega algo nuevo. Por eso el
 * provider no reparte el snapshot por contexto: solo expone el estado de carga y `recargar()`.
 */

const BACKOFF_MS = [1000, 5000, 30000] as const;
const INTERVALO_VERSION_MS = 5 * 60 * 1000;
/** Un foco justo después de un tick (o `focus` + `visibilitychange` seguidos) no repite la consulta. */
const MINIMO_ENTRE_COMPROBACIONES_MS = 15 * 1000;

export interface EstadoRemoteConfig {
  cargando: boolean;
  /** Último error de red (texto), o null si la última carga fue bien. */
  error: string | null;
  /** Epoch ms de la última comprobación contra el servidor (bootstrap o versión). */
  ultimaComprobacion: number | null;
}

interface RemoteConfigContextValue {
  estado: EstadoRemoteConfig;
  /** Fuerza un bootstrap completo (ignora el backoff en curso). */
  recargar: () => Promise<void>;
}

const RemoteConfigContext = createContext<RemoteConfigContextValue | null>(null);

/** `localStorage` puede lanzar (modo privado, cuota, iframes con cookies bloqueadas): se envuelve. */
function storageSeguro(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const prueba = '__repuestop_rc__';
    localStorage.setItem(prueba, '1');
    localStorage.removeItem(prueba);
    return localStorage;
  } catch {
    return null;
  }
}

export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoRemoteConfig>({ cargando: false, error: null, ultimaComprobacion: null });
  const enVuelo = useRef(false);
  const reintento = useRef<number | null>(null);
  const activo = useRef(true);

  const cancelarReintento = () => {
    if (reintento.current !== null) {
      window.clearTimeout(reintento.current);
      reintento.current = null;
    }
  };

  const cargar = useCallback(async (intento = 0): Promise<void> => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    cancelarReintento();
    if (activo.current) setEstado((actual) => ({ ...actual, cargando: true }));
    try {
      const resultado = await fetchBootstrap('BACKOFFICE', remoteConfig.getEtag());
      if (resultado.status === 200) {
        remoteConfig.aplicarBootstrap(resultado.data, resultado.etag, 'red');
      }
      if (activo.current) setEstado({ cargando: false, error: null, ultimaComprobacion: Date.now() });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo cargar la configuración remota.';
      if (activo.current) setEstado((actual) => ({ ...actual, cargando: false, error: mensaje }));
      const espera = BACKOFF_MS[intento];
      if (espera !== undefined && activo.current) {
        reintento.current = window.setTimeout(() => {
          reintento.current = null;
          void cargar(intento + 1);
        }, espera);
      }
    } finally {
      enVuelo.current = false;
    }
  }, []);

  /** Pregunta la versión y solo re-pide el bootstrap si cambió (o si aún no se tiene ninguno). */
  const comprobarVersion = useCallback(async (): Promise<void> => {
    if (enVuelo.current) return;
    if (remoteConfig.getVersion() === null) {
      await cargar(0);
      return;
    }
    try {
      const version = await fetchConfigVersion();
      if (activo.current) setEstado((actual) => ({ ...actual, ultimaComprobacion: Date.now() }));
      if (version !== remoteConfig.getVersion()) await cargar(0);
    } catch {
      // Sin backend nuevo o sin red: se conserva lo que hay y se vuelve a intentar en el próximo tick.
    }
  }, [cargar]);

  useEffect(() => {
    activo.current = true;
    remoteConfig.setStorage(storageSeguro());

    // Caché primero (es síncrona en web, pero la API del store admite AsyncStorage), red después.
    // Si la caché aporta un ETag, la primera petición ya puede responder 304.
    void remoteConfig.hydrate().finally(() => {
      if (activo.current) void cargar(0);
    });

    let ultimaComprobacionLocal = Date.now();
    const comprobarSiToca = () => {
      if (Date.now() - ultimaComprobacionLocal < MINIMO_ENTRE_COMPROBACIONES_MS) return;
      ultimaComprobacionLocal = Date.now();
      void comprobarVersion();
    };
    const alVolverVisible = () => {
      if (document.visibilityState === 'visible') comprobarSiToca();
    };

    const intervalo = window.setInterval(() => {
      ultimaComprobacionLocal = Date.now();
      void comprobarVersion();
    }, INTERVALO_VERSION_MS);
    window.addEventListener('focus', comprobarSiToca);
    document.addEventListener('visibilitychange', alVolverVisible);

    return () => {
      activo.current = false;
      cancelarReintento();
      window.clearInterval(intervalo);
      window.removeEventListener('focus', comprobarSiToca);
      document.removeEventListener('visibilitychange', alVolverVisible);
    };
  }, [cargar, comprobarVersion]);

  const recargar = useCallback(() => cargar(0), [cargar]);

  return (
    <RemoteConfigContext.Provider value={{ estado, recargar }}>
      {children}
    </RemoteConfigContext.Provider>
  );
}

/** Estado de carga de la config remota. Fuera del provider devuelve un estado inerte (no lanza). */
export function useRemoteConfigEstado(): RemoteConfigContextValue {
  const contexto = useContext(RemoteConfigContext);
  return contexto ?? { estado: { cargando: false, error: null, ultimaComprobacion: null }, recargar: async () => undefined };
}
