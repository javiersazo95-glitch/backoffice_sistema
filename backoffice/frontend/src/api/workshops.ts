import apiClient from './client';
import type { WorkshopDetail, WorkshopSummary } from '@/types/workshop';
import type { WorkshopReferralDetail, WorkshopReferralList } from '@/types/workshopReferrals';

/** Todos los talleres con sus metricas; la lista filtra y pagina en memoria, como la de vendedores. */
export async function getWorkshops(): Promise<WorkshopSummary[]> {
  const response = await apiClient.get<WorkshopSummary[]>('/sellers/workshops');
  return response.data;
}

/** Captación por referidos: avance de cada taller acreditado (compradores, meta y días gratis) y los totales. */
export async function getWorkshopReferrals(): Promise<WorkshopReferralList> {
  const response = await apiClient.get<WorkshopReferralList>('/sellers/workshops/referidos');
  return response.data;
}

/** Un taller con los compradores que se registraron con su código. */
export async function getWorkshopReferralDetail(usuarioId: number): Promise<WorkshopReferralDetail> {
  const response = await apiClient.get<WorkshopReferralDetail>(`/sellers/workshops/referidos/${usuarioId}`);
  return response.data;
}

/** Ficha de seguimiento: reportes recibidos, diagnosticos, comentarios y necesidades de compra. */
export async function getWorkshopDetail(usuarioId: number): Promise<WorkshopDetail> {
  const response = await apiClient.get<WorkshopDetail>(`/sellers/workshops/${usuarioId}`);
  return response.data;
}
