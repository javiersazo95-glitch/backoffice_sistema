import apiClient from './client';
import type { WorkshopDetail, WorkshopSummary } from '@/types/workshop';

/** Todos los talleres con sus metricas; la lista filtra y pagina en memoria, como la de vendedores. */
export async function getWorkshops(): Promise<WorkshopSummary[]> {
  const response = await apiClient.get<WorkshopSummary[]>('/sellers/workshops');
  return response.data;
}

/** Ficha de seguimiento: reportes recibidos, diagnosticos, comentarios y necesidades de compra. */
export async function getWorkshopDetail(usuarioId: number): Promise<WorkshopDetail> {
  const response = await apiClient.get<WorkshopDetail>(`/sellers/workshops/${usuarioId}`);
  return response.data;
}
