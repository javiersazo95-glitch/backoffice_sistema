import apiClient from './client';
import type { SystemFeedbackResponse } from '@/types/feedback';

export async function getSystemFeedback(): Promise<SystemFeedbackResponse[]> {
  const response = await apiClient.get<SystemFeedbackResponse[]>('/feedback');
  return response.data;
}

export async function getHomeFeedback(): Promise<SystemFeedbackResponse[]> {
  const response = await apiClient.get<SystemFeedbackResponse[]>('/feedback/public');
  return response.data;
}

export async function setSystemFeedbackApproval(id: number, approved: boolean): Promise<SystemFeedbackResponse> {
  const response = await apiClient.put<SystemFeedbackResponse>(`/feedback/${id}/approval`, null, { params: { approved } });
  return response.data;
}
