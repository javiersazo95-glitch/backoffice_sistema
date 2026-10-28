import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type {
  FallaModeracionDetail,
  FallaResumen,
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


// Moderacion de fallas automotrices (FallaBackofficeController). El motivo queda en la bitacora y se le
// explica a la persona afectada.
export async function getFallaModeration(fallaId: number): Promise<FallaModeracionDetail> {
  const response = await apiClient.get<FallaModeracionDetail>(`/validations/fallas/${encodeURIComponent(String(fallaId))}`);
  return response.data;
}

export async function closeFalla(fallaId: number, motivo: string): Promise<FallaModeracionDetail> {
  const response = await apiClient.patch<FallaModeracionDetail>(`/validations/fallas/${encodeURIComponent(String(fallaId))}/close`, { motivo });
  return response.data;
}

/** Elimina el comentario (y las respuestas que cuelgan de el); devuelve la falla actualizada. */
export async function removeFallaComment(comentarioId: number, motivo: string): Promise<FallaModeracionDetail> {
  const response = await apiClient.delete<FallaModeracionDetail>(
    `/validations/fallas/comentarios/${encodeURIComponent(String(comentarioId))}`,
    { data: { motivo } },
  );
  return response.data;
}

/**
 * El backend no expone "falla de un comentario": el reporte solo trae el id del comentario. Se busca
 * recorriendo las fallas (lista + detalle) hasta dar con el comentario. Devuelve null si ya no existe.
 */
export async function findFallaByComment(comentarioId: number): Promise<FallaModeracionDetail | null> {
  const lista = await apiClient.get<FallaResumen[]>('/validations/fallas');
  for (const resumen of lista.data) {
    const detalle = await getFallaModeration(resumen.id);
    if (detalle.comentarios.some((c) => c.id === comentarioId)) return detalle;
  }
  return null;
}
