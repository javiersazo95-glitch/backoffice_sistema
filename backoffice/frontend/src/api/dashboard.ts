import apiClient from './client';
import type { DashboardSummaryResponse } from '@/types/dashboard';

export async function getSummary(): Promise<DashboardSummaryResponse> {
  const response = await apiClient.get<DashboardSummaryResponse>('/dashboard/summary');
  return response.data;
}