import apiClient from './client';
import type { WorkshopDetail, WorkshopSummary } from '@/types/workshop';

/** Todos los talleres con sus metricas; la lista filtra y pagina en memoria, como la de vendedores. */
export async function getWorkshops(): Promise<WorkshopSummary[]> {
  const response = await apiClient.get<WorkshopSummary[]>('/sellers/workshops');
  return response.data;
}

/** Suspende a un taller aprobado: sale del buscador, cierra sus citas y se le avisa el motivo. */
export async function suspendWorkshop(usuarioId: number, motivo: string): Promise<WorkshopDetail> {
  const response = await apiClient.post<WorkshopDetail>(`/sellers/workshops/${usuarioId}/suspender`, { motivo });
  return response.data;
}

export async function reactivateWorkshop(usuarioId: number): Promise<WorkshopDetail> {
  const response = await apiClient.post<WorkshopDetail>(`/sellers/workshops/${usuarioId}/reactivar`);
  return response.data;
}

/** Ficha de seguimiento: reportes recibidos, diagnosticos, comentarios y necesidades de compra. */
export async function getWorkshopDetail(usuarioId: number): Promise<WorkshopDetail> {
  const response = await apiClient.get<WorkshopDetail>(`/sellers/workshops/${usuarioId}`);
  return response.data;
}
