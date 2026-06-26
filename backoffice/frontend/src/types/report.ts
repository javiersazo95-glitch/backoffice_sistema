export interface ReportResponse {
  id: number;
  idExterno?: string;
  reportanteId: number;
  reportanteName: string;
  reportanteEmail: string;
  reportanteType: 'COMPRADOR' | 'VENDEDOR';
  reportadoId: number;
  reportadoName: string;
  reportadoEmail: string;
  reportadoType: 'COMPRADOR' | 'VENDEDOR';
  conversacionId?: number;
  motivo: string;
  descripcion: string;
  fechaCreacion: string;
}

export interface ReportsSummaryResponse {
  totalReportes: number;
  reportesCompradores: number;
  reportesVendedores: number;
}

export interface ReportFilterRequest {
  search?: string;
  reporterType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}
