export type ReportObjectType = 'ANUNCIO' | 'PRODUCTO' | 'TIENDA' | 'CHAT_COTIZACION' | 'OTRO';

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
