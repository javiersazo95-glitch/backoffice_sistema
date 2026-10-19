import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type {
  OpinionModerationDetail,
  OpinionReportType,
  ReportFilterRequest,
  ReportResponse,
  ReportsSummaryResponse,
} from '@/types/report';

export async function getReports(params?: ReportFilterRequest): Promise<PageResponse<ReportResponse>> {
  const response = await apiClient.get<PageResponse<ReportResponse>>('/reports', { params });
  return response.data;
}

export async function getReportsSummary(): Promise<ReportsSummaryResponse> {
  const response = await apiClient.get<ReportsSummaryResponse>('/reports/summary');
  return response.data;
}


// Moderacion de opiniones reportadas. El backend acepta OPINION_PRODUCTO/OPINION_TIENDA (el mismo
// tipoObjeto del reporte) y el id es el objetoId del reporte.
const opinionPath = (tipo: OpinionReportType, id: number) =>
  `/reports/opiniones/${encodeURIComponent(tipo)}/${encodeURIComponent(String(id))}`;

export async function getOpinionModeration(tipo: OpinionReportType, id: number): Promise<OpinionModerationDetail> {
  const response = await apiClient.get<OpinionModerationDetail>(opinionPath(tipo, id));
  return response.data;
}

/** Retira comentario y fotos de la vista publica (la nota sigue contando) y avisa al comprador. */
export async function hideOpinion(tipo: OpinionReportType, id: number, motivo: string): Promise<OpinionModerationDetail> {
  const response = await apiClient.post<OpinionModerationDetail>(`${opinionPath(tipo, id)}/ocultar`, { motivo });
  return response.data;
}

export async function restoreOpinion(tipo: OpinionReportType, id: number): Promise<OpinionModerationDetail> {
  const response = await apiClient.post<OpinionModerationDetail>(`${opinionPath(tipo, id)}/restaurar`);
  return response.data;
}
