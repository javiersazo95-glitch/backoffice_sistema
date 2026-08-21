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

// ==========================================
// Panel de Moderación del Mural de Anuncios
// ==========================================

export async function getAdValidations(): Promise<import('@/types/adValidation').AdValidationItem[]> {
  try {
    const response = await apiClient.get<import('@/types/adValidation').AdValidationItem[]>('/validations/anuncios');
    return response.data;
  } catch (error) {
    // Fallback si la ruta admin directa no está disponible
    const response = await apiClient.get<import('@/types/adValidation').AdValidationItem[]>('/anuncios');
    return response.data;
  }
}

export async function approveAdValidation(id: string | number): Promise<import('@/types/adValidation').AdValidationItem> {
  const numericId = String(id).replace(/\D/g, '') || id;
  try {
    const response = await apiClient.patch<import('@/types/adValidation').AdValidationItem>(`/validations/anuncios/${numericId}/approve`);
    return response.data;
  } catch (error) {
    try {
      const response = await apiClient.post<import('@/types/adValidation').AdValidationItem>(`/validations/anuncios/${numericId}/approve`);
      return response.data;
    } catch {
      const response = await apiClient.patch<import('@/types/adValidation').AdValidationItem>(`/anuncios/${numericId}/approve`);
      return response.data;
    }
  }
}

export async function rejectAdValidation(id: string | number, reason: string): Promise<import('@/types/adValidation').AdValidationItem> {
  const numericId = String(id).replace(/\D/g, '') || id;
  const payload = { notes: reason, reason };
  try {
    const response = await apiClient.patch<import('@/types/adValidation').AdValidationItem>(`/validations/anuncios/${numericId}/reject`, payload);
    return response.data;
  } catch (error) {
    try {
      const response = await apiClient.post<import('@/types/adValidation').AdValidationItem>(`/validations/anuncios/${numericId}/reject`, payload);
      return response.data;
    } catch {
      const response = await apiClient.patch<import('@/types/adValidation').AdValidationItem>(`/anuncios/${numericId}/reject`, payload);
      return response.data;
    }
  }
}