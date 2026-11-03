export type OpinionReportType = 'OPINION_PRODUCTO' | 'OPINION_TIENDA';

export type FallaReportType = 'FALLA' | 'FALLA_COMENTARIO';

export type ReportObjectType = 'ANUNCIO' | 'PRODUCTO' | 'TIENDA' | 'TALLER' | 'NECESIDAD_COMPRA' | 'CHAT_COTIZACION' | OpinionReportType | FallaReportType | 'OTRO';

export interface ReportResponse {
  id: number;
  idExterno?: string;
  reportanteId: number;
  reportanteName: string;
  reportanteEmail: string;
  reportanteType: 'COMPRADOR' | 'VENDEDOR';
  reportanteFounder?: boolean;
  reportadoId: number;
  reportadoName: string;
  reportadoEmail: string;
  reportadoType: 'COMPRADOR' | 'VENDEDOR';
  reportadoFounder?: boolean;
  conversacionId?: number;
  tipoObjeto?: ReportObjectType;
  objetoId?: number;
  objetoTitulo?: string;
  motivo: string;
  descripcion?: string;
  fechaCreacion: string;
}

export interface ReportsSummaryResponse {
  totalReportes: number;
  reportesCompradores: number;
  reportesVendedores: number;
  reportesAnuncios: number;
  reportesProductos: number;
  reportesTiendas: number;
  reportesChatsCotizacion: number;
}

export interface ReportFilterRequest {
  search?: string;
  reporterType?: string;
  objectType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}

/**
 * Opinion de un comprador vista por el moderador (GET /reports/opiniones/{tipo}/{id}).
 * Trae el contenido completo aunque este oculto: ocultar solo lo retira de la vista publica.
 */
export interface OpinionModerationDetail {
  tipo: OpinionReportType;
  id: number;
  pedidoId?: number | null;
  rating?: number | null;
  comment?: string | null;
  imageUrls?: string[] | null;
  productName?: string | null;
  storeId?: number | null;
  storeName?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  ratedAt?: string | null;
  hidden: boolean;
  hiddenAt?: string | null;
  hiddenReason?: string | null;
  hiddenBy?: string | null;
  reports: number;
}

/** Respuesta de GET /validations/fallas (FallaModeracionDTOs.Resumen). */
export interface FallaResumen {
  id: number;
  titulo: string;
  vehiculo?: string | null;
  patente?: string | null;
  autorNombre?: string | null;
  autorEmail?: string | null;
  comuna?: string | null;
  estado: string;
  vigente: boolean;
  diagnosticos: number;
  createdAt: string;
}

export interface FallaModeracionComentario {
  id: number;
  respondeAId?: number | null;
  texto: string;
  precioDesde?: number | null;
  precioHasta?: number | null;
  autorNombre?: string | null;
  autorEmail?: string | null;
  autorRol?: string | null;
  taller?: string | null;
  createdAt: string;
}

/** Falla con sus comentarios, vista por el moderador (FallaModeracionDTOs.Detalle). */
export interface FallaModeracionDetail {
  id: number;
  titulo: string;
  descripcion?: string | null;
  antesDelFallo?: string | null;
  vehiculo?: string | null;
  patente?: string | null;
  autorNombre?: string | null;
  autorEmail?: string | null;
  region?: string | null;
  comuna?: string | null;
  sintomas?: string[] | null;
  fotos?: string[] | null;
  estado: string;
  vigente: boolean;
  venceEn?: string | null;
  cerradaEn?: string | null;
  createdAt: string;
  comentarios: FallaModeracionComentario[];
}
