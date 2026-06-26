import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type {
  MediationResponse,
  MediationDetailResponse,
  MediationMessageResponse,
  ResolvedCaseResponse,
  InitMediationRequest,
  MediationMessageRequest,
  ResolveCaseRequest,
  MediationFilterRequest,
} from '@/types/mediation';

export async function getMediations(params?: MediationFilterRequest): Promise<PageResponse<MediationResponse>> {
  const response = await apiClient.get<PageResponse<MediationResponse>>('/mediations', { params });
  return response.data;
}

export async function getMediationById(id: number): Promise<MediationDetailResponse> {
  const response = await apiClient.get<MediationDetailResponse>(`/mediations/${id}`);
  return response.data;
}

export async function createMediation(data: InitMediationRequest): Promise<MediationResponse> {
  const response = await apiClient.post<MediationResponse>('/mediations', data);
  return response.data;
}

export async function initMediation(id: number, data: InitMediationRequest): Promise<MediationResponse> {
  const response = await apiClient.patch<MediationResponse>(`/mediations/${id}/init`, data);
  return response.data;
}

export async function blockAccount(id: number): Promise<MediationResponse> {
  const response = await apiClient.patch<MediationResponse>(`/mediations/${id}/block-account`);
  return response.data;
}

export async function resolveCase(id: number, data: ResolveCaseRequest, document: File): Promise<ResolvedCaseResponse> {
  const formData = new FormData();
  formData.append('request', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  formData.append('document', document);
  const response = await apiClient.post<ResolvedCaseResponse>(`/mediations/${id}/resolve`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function reactivateAccount(id: number, data: ResolveCaseRequest, document: File): Promise<ResolvedCaseResponse> {
  const formData = new FormData();
  formData.append('request', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  formData.append('document', document);
  const response = await apiClient.post<ResolvedCaseResponse>(`/mediations/${id}/reactivate`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function getMessages(mediationId: number, page = 0, size = 4): Promise<PageResponse<MediationMessageResponse>> {
  const response = await apiClient.get<PageResponse<MediationMessageResponse>>(`/mediations/${mediationId}/messages`, {
    params: { page, size },
  });
  return response.data;
}

export async function addMessage(mediationId: number, data: MediationMessageRequest): Promise<MediationMessageResponse> {
  const response = await apiClient.post<MediationMessageResponse>(`/mediations/${mediationId}/messages`, data);
  return response.data;
}

export async function editMessage(mediationId: number, messageId: number, data: MediationMessageRequest): Promise<MediationMessageResponse> {
  const response = await apiClient.put<MediationMessageResponse>(`/mediations/${mediationId}/messages/${messageId}`, data);
  return response.data;
}

export async function deleteMessage(mediationId: number, messageId: number): Promise<void> {
  await apiClient.delete(`/mediations/${mediationId}/messages/${messageId}`);
}