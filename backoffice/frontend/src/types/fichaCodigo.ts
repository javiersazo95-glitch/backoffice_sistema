// Fichas por codigo del fabricante (25-nov): espejo de FichaCodigoBackofficeDTOs del backend.

export type FichaEstado = 'AUTO' | 'VERIFICADA' | 'RECHAZADA';
export type FichaFiltro = 'todas' | 'sin-verificar' | 'media' | 'reportadas' | 'verificadas' | 'rechazadas';

export interface FichaResumen {
  id: number;
  codigo: string;
  marca: string;
  nombre: string;
  estado: FichaEstado;
  confianza: 'ALTA' | 'MEDIA' | string;
  fuente: string;
  categoria: string | null;
  subcategoria: string | null;
  vehiculos: number;
  fueraDeCatalogo: number;
  usos: number;
  tiendas: number;
  editadas: number;
  reportes: number;
  corregida: boolean;
  venceEn: string | null;
  actualizadaEn: string | null;
}

export interface FichaCifras {
  total: number;
  sinVerificar: number;
  confianzaMedia: number;
  reportadas: number;
  verificadas: number;
  rechazadas: number;
}

export interface FichaPagina {
  content: FichaResumen[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  cifras: FichaCifras;
}

export interface FichaGrupoVehiculo {
  marca: string;
  modelo: string;
  anioDesde: number | null;
  anioHasta: number | null;
  motor: string | null;
  vehiculoCatalogoIds: number[];
  versiones: string[];
  segura: boolean;
}

export interface FichaCompatibilidad {
  grupos: FichaGrupoVehiculo[];
  fueraDeCatalogo: string[];
}

export interface FichaMedio {
  tipo: string;
  descripcion: string | null;
  clave: string | null;
  url: string | null;
}

export interface FichaPublicacion {
  productoId: number;
  nombre: string;
  sku: string | null;
  tienda: string;
  tiendaId: number;
  condicion: string | null;
  activa: boolean;
  origen: string | null;
  vehiculosPublicados: number;
  faltan: number;
  sobran: number;
  faltanEjemplos: string[];
  sobranEjemplos: string[];
}

export interface FichaReporte {
  id: number;
  productoId: number;
  descripcion: string | null;
  fecha: string | null;
}

export interface FichaDetalle {
  resumen: FichaResumen;
  motivoRechazo: string | null;
  verificadaPor: string | null;
  verificadaEn: string | null;
  categoriaExterna: string | null;
  subcategoriaId: number | null;
  compatibilidad: FichaCompatibilidad;
  fotos: FichaMedio[];
  originales: string[];
  puedeRecalcular: boolean;
  publicaciones: FichaPublicacion[];
  publicacionesTotal: number;
  reportes: FichaReporte[];
}

export interface FichaResultado {
  detalle: FichaDetalle;
  avisados: number;
  advertencias: string[];
}

/** Un vehiculo al corregir: con ids se conserva tal cual; sin ellos se buscan las versiones por marca, modelo y anios. */
export interface GrupoCorreccion {
  marca?: string | null;
  modelo?: string | null;
  anioDesde?: number | null;
  anioHasta?: number | null;
  motor?: string | null;
  vehiculoCatalogoIds?: number[] | null;
}

export interface FichaCorreccion {
  nombre?: string | null;
  subcategoriaId?: number | null;
  grupos?: GrupoCorreccion[] | null;
  motivo: string;
  avisar?: boolean;
}

export interface FichaManual {
  codigo: string;
  marca: string;
  nombre: string;
  subcategoriaId?: number | null;
  grupos?: GrupoCorreccion[];
}

export type AliasTipo = 'MODELO' | 'CATEGORIA';

export interface AliasFila {
  id: number;
  tipo: AliasTipo;
  texto: string;
  destinoId: number | null;
  destino: string | null;
  veces: number;
  actualizadoEn: string | null;
}

export interface AliasPagina {
  content: AliasFila[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface AliasResultado {
  alias: AliasFila;
  fichasActualizadas: number;
}

export interface CodigoSinFicha {
  codigo: string;
  semanas: number;
  ultimaBusqueda: string | null;
}

export interface FichaUso {
  fuente: string;
  llave: boolean;
  buscarActivo: boolean;
  mediosActivos: boolean;
  consultasHoy: number;
  consultasMes: number;
  erroresSemana: number;
  topeDiario: number;
  cuotaMensual: number;
  fichas: number;
  verificadas: number;
  sinVerificar: number;
  itemsPendientes: number;
}

export interface OpcionCatalogo {
  id: number;
  nombre: string;
}

export interface SubcategoriaOpcion {
  id: number;
  nombre: string;
  categoriaId: number;
  categoriaNombre: string;
}
