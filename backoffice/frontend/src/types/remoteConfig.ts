/**
 * Tipos del bootstrap de configuración del Mantenedor común.
 *
 * Espejo de `dto/mantenedor/BootstrapDTO.java` y del contrato
 * `docs/arquitectura/contrato-mantenedor-bootstrap.md` (mono-repo, sección 2). Si el contrato
 * cambia, cambia primero allá: los cuatro clientes (app, Market, panel y backoffice) lo consumen.
 *
 * Este archivo se copia tal cual a Backoffice_movil (`sync:web`), así que no puede depender del DOM.
 */

/** Cliente que pide el bootstrap. El backoffice siempre pide `BACKOFFICE`. */
export type ClienteConfig = 'APP' | 'MARKET' | 'PANEL' | 'BACKOFFICE';

/**
 * Cómo interpretar el texto de `parametros[clave]`. Los valores viajan SIEMPRE como string y el
 * cliente los parsea según este tipo (NUMBER → número, PERCENT → decimal 0..1, MONEY → entero
 * CLP, BOOLEAN → "true"/"false", STRING → texto, JSON → JSON.parse).
 */
export type TipoParametro = 'NUMBER' | 'PERCENT' | 'MONEY' | 'BOOLEAN' | 'STRING' | 'JSON';

/** Opción de una lista desplegable (`rt_lista_opcion`). Solo llegan las activas para el cliente. */
export interface OpcionListaDTO {
  valor: string;
  etiqueta: string;
  descripcion: string | null;
  orden: number;
  esDefault: boolean;
  iconoUrl: string | null;
  color: string | null;
  /** Depende de la lista: `BANCO` trae `{codigoBci}`, `COURIER` `{trackingUrl, local}`, etc. */
  metadata: Record<string, unknown> | null;
}

export interface SubcategoriaDTO {
  id: number;
  nombre: string;
  slug: string;
  orden: number;
  imagenUrl: string | null;
}

export interface CategoriaDTO {
  id: number;
  nombre: string;
  /** Inmutable una vez creado: es la clave de cruce entre clientes y backend. */
  slug: string;
  familia: string | null;
  orden: number;
  iconoUrl: string | null;
  /** Nombre de ícono lucide, fallback cuando no hay `iconoUrl`. */
  iconoNombre: string | null;
  color: string | null;
  imagenUrl: string | null;
  subcategorias: SubcategoriaDTO[];
}

export interface MarcaVehiculoDTO {
  id: number;
  nombre: string;
  slug: string;
  orden: number;
  iconoUrl: string | null;
  color: string | null;
  destacada: boolean;
}

export interface MarcaRepuestoDestacadaDTO {
  id: number;
  nombre: string;
  slug: string;
  orden: number;
  iconoUrl: string | null;
  color: string | null;
  calidadReferencial: string | null;
}

/** Respuesta de `GET /api/v1/config/bootstrap?cliente=...`. */
export interface BootstrapDTO {
  /** `rt_config_version.version`; sube con cualquier cambio de catálogo, lista, parámetro o flag. */
  version: number;
  cliente: ClienteConfig;
  generadoEn: string;
  /** Solo parámetros con `publico=true`, siempre como texto. */
  parametros: Record<string, string>;
  parametrosTipos: Record<string, TipoParametro>;
  /** Ya resuelto para el cliente (fila del cliente > fila TODOS). Ausente = usa tu fallback local. */
  flags: Record<string, boolean>;
  /** Solo entradas con metadata no nula (p. ej. `global.mantenimiento` → `{mensaje}`). */
  flagsMetadata: Record<string, Record<string, unknown>>;
  /** Solo opciones activas y aplicables al cliente, ordenadas por `orden, etiqueta`. */
  listas: Record<string, OpcionListaDTO[]>;
  categorias: CategoriaDTO[];
  marcasVehiculo: MarcaVehiculoDTO[];
  marcasRepuestoDestacadas: MarcaRepuestoDestacadaDTO[];
}

/** Respuesta de `GET /api/v1/config/version`. */
export interface ConfigVersionDTO {
  version: number;
}

/** Catálogos que viajan en el bootstrap (los modelos de vehículo se piden aparte, por marca). */
export type CatalogoNombre = 'categorias' | 'marcasVehiculo' | 'marcasRepuestoDestacadas';

export type CatalogoDe<N extends CatalogoNombre> = BootstrapDTO[N];

/**
 * Lo que se guarda en la caché local bajo `repuestop.remote-config.<CLIENTE>.v1` (contrato,
 * sección 6). `etag` se agrega por comodidad: el servidor lo manda como `W/"<version>-<cliente>"`
 * y guardarlo evita reconstruirlo a mano al revalidar.
 */
export interface RemoteConfigCache {
  version: number;
  data: BootstrapDTO;
  /** ISO 8601. */
  guardadoEn: string;
  etag?: string | null;
}

/** Códigos de lista que consume el backoffice (contrato, sección 3). */
export const LISTA_BANCO = 'BANCO';
export const LISTA_TIPO_CUENTA_BANCARIA = 'TIPO_CUENTA_BANCARIA';
export const LISTA_MOTIVO_CANCELACION_PEDIDO = 'MOTIVO_CANCELACION_PEDIDO';

/** Flags del backoffice (contrato, sección 5). Fallback local: `true`. */
export const FLAG_NAV_MANTENEDOR = 'backoffice.nav.mantenedor';
export const FLAG_AREA_ADMINISTRACION = 'backoffice.area.administracion-contable';
export const FLAG_AREA_SOPORTE = 'backoffice.area.soporte';
export const FLAG_AREA_MEDIACION = 'backoffice.area.mediacion-confianza';

/** Parámetros públicos del grupo COMISION que usa el backoffice (contrato, sección 4). */
export const PARAM_COMISION_TASA_ALTA = 'comision.tasa.alta';
export const PARAM_COMISION_FUNDADOR = 'comision.fundador.porcentaje';
export const PARAM_PASARELA_PORCENTAJE = 'pasarela.porcentaje';
export const PARAM_PASARELA_IVA = 'pasarela.iva';
