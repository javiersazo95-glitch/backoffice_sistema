import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type { ValidationResponse } from '@/types/validation';
import type { CreateValidationRequest } from '@/types/validation';

export async function getValidations(page = 0, size = 8): Promise<PageResponse<ValidationResponse>> {
  const response = await apiClient.get<PageResponse<ValidationResponse>>('/validations', {
    params: { page, size },
  });
  return response.data;
}

export async function getValidationById(id: number): Promise<ValidationResponse> {
  const response = await apiClient.get<ValidationResponse>(`/validations/${id}`);
  return response.data;
}

export async function createValidation(data: CreateValidationRequest): Promise<ValidationResponse> {
  const response = await apiClient.post<ValidationResponse>('/validations', data);
  return response.data;
}

export async function approveValidation(id: number): Promise<ValidationResponse> {
  const response = await apiClient.patch<ValidationResponse>(`/validations/${id}/approve`);
  return response.data;
}

export async function requestCorrection(id: number, notes: string): Promise<ValidationResponse> {
  const response = await apiClient.patch<ValidationResponse>(`/validations/${id}/request-correction`, { notes });
  return response.data;
}

export async function rejectValidation(id: number, notes?: string): Promise<ValidationResponse> {
  const response = await apiClient.patch<ValidationResponse>(`/validations/${id}/reject`, { notes });
  return response.data;
}