export type OpinionReportType = 'OPINION_PRODUCTO' | 'OPINION_TIENDA';

export type ReportObjectType = 'ANUNCIO' | 'PRODUCTO' | 'TIENDA' | 'CHAT_COTIZACION' | OpinionReportType | 'OTRO';

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
