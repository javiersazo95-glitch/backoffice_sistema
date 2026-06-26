import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type { AlertResponse, AlertSeverity } from '@/types/alert';
import type { MediationResponse } from '@/types/mediation';

export async function getAlerts(search?: string, severity?: AlertSeverity, page = 0, size = 8): Promise<PageResponse<AlertResponse>> {
  const response = await apiClient.get<PageResponse<AlertResponse>>('/alerts', {
    params: { search, severity, page, size },
  });
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