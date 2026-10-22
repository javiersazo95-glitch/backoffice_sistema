import type {
  BootstrapDTO,
  CatalogoDe,
  CatalogoNombre,
  ClienteConfig,
  OpcionListaDTO,
  RemoteConfigCache,
  TipoParametro,
} from '@/types/remoteConfig';

/**
 * Store de la configuración remota del Mantenedor común (contrato, sección 6).
 *
 * Guarda un snapshot inmutable en memoria y lo expone con `get()`/`subscribe()` para que React lo
 * lea con `useSyncExternalStore`, y con accesores sin hook (`getFlag`, `getParametro`, `getLista`,
 * `getCatalogo`) para código fuera de React, como las constantes de comisiones.
 *
 * Regla central: NUNCA bloquea ni rompe nada. Sin backend nuevo, sin caché o con un valor mal
 * formado, cada accesor devuelve el fallback que le pasan, así el backoffice se comporta
 * exactamente como antes de existir el mantenedor.
 *
 * Se copia a Backoffice_movil (`sync:web`): no toca `window`, `document` ni `localStorage`. El
 * almacenamiento se inyecta (web: `localStorage`; app: AsyncStorage, que es asíncrono).
 */

/** Mínimo común entre `localStorage` (síncrono) y AsyncStorage (promesas). */
export interface RemoteConfigStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

/** De dónde salió lo que hay en memoria. `ninguno` = solo fallbacks locales. */
export type OrigenConfig = 'ninguno' | 'cache' | 'red';

export interface RemoteConfigSnapshot {
  data: BootstrapDTO | null;
  version: number | null;
  etag: string | null;
  origen: OrigenConfig;
  /** Epoch ms de la última vez que cambió el snapshot. */
  actualizadoEn: number | null;
}

export type Listener = () => void;

/** Clave de caché acordada en el contrato: `repuestop.remote-config.<CLIENTE>.v1`. */
export function cacheKeyFor(cliente: ClienteConfig): string {
  return `repuestop.remote-config.${cliente}.v1`;
}

/** ETag que el backend emite para una versión (contrato, sección 1). Útil al revalidar desde caché. */
export function etagFor(version: number, cliente: ClienteConfig): string {
  return `W/"${version}-${cliente}"`;
}

/**
 * Convierte el texto de un parámetro según su tipo. Devuelve `undefined` cuando el texto no es
 * interpretable (NaN, JSON inválido), para que quien llama caiga al fallback en vez de propagar
 * un valor basura a un cálculo de comisiones.
 */
export function parseParametro(valor: string | undefined | null, tipo: TipoParametro | undefined): unknown {
  if (valor === undefined || valor === null) return undefined;
  switch (tipo) {
    case 'NUMBER':
    case 'PERCENT':
    case 'MONEY': {
      const n = Number(String(valor).trim().replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    }
    case 'BOOLEAN': {
      const texto = String(valor).trim().toLowerCase();
      if (texto === 'true') return true;
      if (texto === 'false') return false;
      return undefined;
    }
    case 'JSON': {
      try {
        return JSON.parse(valor);
      } catch {
        return undefined;
      }
    }
    case 'STRING':
      return valor;
    default:
      // Sin tipo declarado se entrega el texto; `getParametro` lo ajusta al tipo del fallback.
      return valor;
  }
}

/** Comprobación mínima de que lo leído (de red o de caché) tiene la forma del contrato. */
export function esBootstrapValido(data: unknown): data is BootstrapDTO {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<BootstrapDTO>;
  return (
    typeof d.version === 'number' &&
    typeof d.cliente === 'string' &&
    !!d.parametros && typeof d.parametros === 'object' &&
    !!d.flags && typeof d.flags === 'object' &&
    !!d.listas && typeof d.listas === 'object'
  );
}

export interface RemoteConfigStore {
  readonly cliente: ClienteConfig;
  get(): RemoteConfigSnapshot;
  subscribe(listener: Listener): () => void;
  /** Define dónde se guarda la caché. Debe llamarse antes de `hydrate()`. */
  setStorage(storage: RemoteConfigStorage | null): void;
  /** Carga la caché local en memoria. Resuelve `true` si había algo utilizable. */
  hydrate(): Promise<boolean>;
  /** Reemplaza el snapshot con un bootstrap recién llegado (`red`) o leído de caché (`cache`). */
  aplicarBootstrap(data: BootstrapDTO, etag: string | null, origen: Exclude<OrigenConfig, 'ninguno'>): void;
  getVersion(): number | null;
  getEtag(): string | null;
  getFlag(clave: string, fallback?: boolean): boolean;
  getFlagMetadata(clave: string): Record<string, unknown> | null;
  getParametro<T extends number | string | boolean>(clave: string, fallback: T): T;
  getParametroJson<T>(clave: string, fallback: T): T;
  getLista(codigo: string, fallback?: OpcionListaDTO[]): OpcionListaDTO[];
  /** Etiqueta de un valor dentro de una lista, o `undefined` si la lista o el valor no están. */
  etiquetaDeLista(codigo: string, valor: string | null | undefined): string | undefined;
  getCatalogo<N extends CatalogoNombre>(nombre: N, fallback?: CatalogoDe<N>): CatalogoDe<N>;
  /** Vuelve al estado inicial (solo fallbacks). Pensado para pruebas. */
  reset(): void;
}

const SNAPSHOT_INICIAL: RemoteConfigSnapshot = Object.freeze({
  data: null,
  version: null,
  etag: null,
  origen: 'ninguno',
  actualizadoEn: null,
});

const LISTA_VACIA: OpcionListaDTO[] = [];

export function createRemoteConfigStore(cliente: ClienteConfig): RemoteConfigStore {
  let snapshot: RemoteConfigSnapshot = SNAPSHOT_INICIAL;
  let storage: RemoteConfigStorage | null = null;
  const listeners = new Set<Listener>();
  const cacheKey = cacheKeyFor(cliente);

  const notificar = () => {
    for (const listener of listeners) listener();
  };

  const persistir = (data: BootstrapDTO, etag: string | null) => {
    if (!storage) return;
    const cache: RemoteConfigCache = { version: data.version, data, guardadoEn: new Date().toISOString(), etag };
    try {
      // Puede ser una promesa (AsyncStorage) o lanzar (cuota llena, modo privado): en ambos casos
      // la caché es solo una comodidad, la config en memoria ya está aplicada.
      void Promise.resolve(storage.setItem(cacheKey, JSON.stringify(cache))).catch(() => undefined);
    } catch {
      // Sin caché; la próxima carga vuelve a pedir el bootstrap completo.
    }
  };

  const store: RemoteConfigStore = {
    cliente,

    get: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setStorage(nuevo) {
      storage = nuevo;
    },

    async hydrate() {
      if (!storage) return false;
      let crudo: string | null = null;
      try {
        crudo = await Promise.resolve(storage.getItem(cacheKey));
      } catch {
        return false;
      }
      if (!crudo) return false;
      let cache: Partial<RemoteConfigCache>;
      try {
        cache = JSON.parse(crudo) as Partial<RemoteConfigCache>;
      } catch {
        return false;
      }
      if (!cache || !esBootstrapValido(cache.data)) return false;
      // Si la red ya respondió mientras se leía la caché (AsyncStorage es asíncrono), manda la red.
      if (snapshot.origen === 'red') return true;
      store.aplicarBootstrap(cache.data, cache.etag ?? etagFor(cache.data.version, cliente), 'cache');
      return true;
    },

    aplicarBootstrap(data, etag, origen) {
      snapshot = {
        data,
        version: data.version,
        etag: etag ?? etagFor(data.version, cliente),
        origen,
        actualizadoEn: Date.now(),
      };
      if (origen === 'red') persistir(data, snapshot.etag);
      notificar();
    },

    getVersion: () => snapshot.version,

    getEtag: () => snapshot.etag,

    getFlag(clave, fallback = true) {
      const valor = snapshot.data?.flags?.[clave];
      return typeof valor === 'boolean' ? valor : fallback;
    },

    getFlagMetadata(clave) {
      const meta = snapshot.data?.flagsMetadata?.[clave];
      return meta && typeof meta === 'object' ? meta : null;
    },

    getParametro(clave, fallback) {
      const data = snapshot.data;
      if (!data) return fallback;
      const crudo = data.parametros?.[clave];
      if (crudo === undefined || crudo === null) return fallback;
      let tipo = data.parametrosTipos?.[clave];
      // Sin tipo declarado, se infiere del fallback para no entregar "0.07" (texto) donde se
      // espera 0.07 (número).
      if (!tipo) {
        tipo = typeof fallback === 'number' ? 'NUMBER' : typeof fallback === 'boolean' ? 'BOOLEAN' : 'STRING';
      }
      const parseado = parseParametro(crudo, tipo);
      // Un parámetro cuyo tipo no coincide con lo que espera el código (p. ej. alguien lo cambió
      // a STRING en el mantenedor) no debe colarse en un cálculo: se usa el fallback.
      return typeof parseado === typeof fallback ? (parseado as typeof fallback) : fallback;
    },

    getParametroJson(clave, fallback) {
      const data = snapshot.data;
      if (!data) return fallback;
      const crudo = data.parametros?.[clave];
      if (crudo === undefined || crudo === null) return fallback;
      const parseado = parseParametro(crudo, 'JSON');
      return parseado === undefined ? fallback : (parseado as typeof fallback);
    },

    getLista(codigo, fallback = LISTA_VACIA) {
      const lista = snapshot.data?.listas?.[codigo];
      // Ausente = "usa tu fallback". Presente aunque vacía = decisión explícita del mantenedor.
      return Array.isArray(lista) ? lista : fallback;
    },

    etiquetaDeLista(codigo, valor) {
      if (!valor) return undefined;
      const lista = snapshot.data?.listas?.[codigo];
      if (!Array.isArray(lista)) return undefined;
      const buscado = valor.toUpperCase();
      return lista.find((opcion) => opcion.valor.toUpperCase() === buscado)?.etiqueta;
    },

    getCatalogo(nombre, fallback) {
      const catalogo = snapshot.data?.[nombre];
      if (Array.isArray(catalogo)) return catalogo as CatalogoDe<typeof nombre>;
      return (fallback ?? []) as CatalogoDe<typeof nombre>;
    },

    reset() {
      snapshot = SNAPSHOT_INICIAL;
      notificar();
    },
  };

  return store;
}

/**
 * Instancia única del backoffice. El provider (`context/RemoteConfigContext`) le inyecta el
 * storage y la alimenta; el resto del código solo lee.
 */
export const remoteConfig: RemoteConfigStore = createRemoteConfigStore('BACKOFFICE');
