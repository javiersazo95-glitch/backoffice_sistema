import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type { AuditLogResponse, AuditFilterRequest } from '@/types/audit';

export async function getAuditLogs(params?: AuditFilterRequest): Promise<PageResponse<AuditLogResponse>> {
  const response = await apiClient.get<PageResponse<AuditLogResponse>>('/audits', { params });
  return response.data;
}

export async function getAuditLogById(id: number): Promise<AuditLogResponse> {
  const response = await apiClient.get<AuditLogResponse>(`/audits/${id}`);
  return response.data;
}