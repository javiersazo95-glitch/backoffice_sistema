import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type { ReportResponse, ReportsSummaryResponse, ReportFilterRequest } from '@/types/report';

export async function getReports(params?: ReportFilterRequest): Promise<PageResponse<ReportResponse>> {
  const response = await apiClient.get<PageResponse<ReportResponse>>('/reports', { params });
  return response.data;
}

export async function getReportsSummary(): Promise<ReportsSummaryResponse> {
  const response = await apiClient.get<ReportsSummaryResponse>('/reports/summary');
  return response.data;
}

export async function getReportsBySellerId(sellerId: number): Promise<ReportResponse[]> {
  const response = await apiClient.get<ReportResponse[]>(`/reports/seller/${sellerId}`);
  return response.data;
}
