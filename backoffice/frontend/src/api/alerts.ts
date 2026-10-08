import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type { AlertResponse, AlertSeverity } from '@/types/alert';
import type { MediationResponse } from '@/types/mediation';

/** `reviewed=false` trae solo las no revisadas; sin el parametro, todas. */
export async function getAlerts(search?: string, severity?: AlertSeverity, page = 0, size = 8, reviewed?: boolean): Promise<PageResponse<AlertResponse>> {
  const response = await apiClient.get<PageResponse<AlertResponse>>('/alerts', {
    params: { search, severity, page, size, reviewed },
  });
  return response.data;
}

/** Totales por severidad sobre TODAS las alertas (no solo la pagina visible). */
export interface AlertsSummary { total: number; critica: number; alta: number; media: number }

export async function getAlertsSummary(reviewed?: boolean): Promise<AlertsSummary> {
  const response = await apiClient.get<AlertsSummary>('/alerts/summary', { params: { reviewed } });
  return response.data;
}

export async function markAsReviewed(id: number): Promise<AlertResponse> {
  const response = await apiClient.patch<AlertResponse>(`/alerts/${id}/review`);
  return response.data;
}

export async function escalateToMediation(id: number): Promise<MediationResponse> {
  const response = await apiClient.post<MediationResponse>(`/alerts/${id}/escalate`);
  return response.data;
}