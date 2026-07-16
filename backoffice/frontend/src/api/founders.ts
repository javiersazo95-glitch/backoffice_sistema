import apiClient from './client';
import type { PageResponse } from '@/types/common';

export interface FounderSeller {
  sellerId: number;
  storeName: string;
  userName: string;
  email: string;
  founder: boolean;
  founderSince?: string | null;
  founderDays: number;
  registeredAt: string;
}

export async function getFounderConfig() {
  const { data } = await apiClient.get<{ founderForNewSellers: boolean }>('/backoffice/founders/config');
  return data;
}

export async function updateFounderConfig(founderForNewSellers: boolean) {
  const { data } = await apiClient.put<{ founderForNewSellers: boolean }>('/backoffice/founders/config', { founderForNewSellers });
  return data;
}

export async function listFounders(params: { search?: string; status?: string; page?: number; size?: number }) {
  const { data } = await apiClient.get<PageResponse<FounderSeller>>('/backoffice/founders', { params });
  return data;
}

export async function setFounder(sellerId: number, founder: boolean) {
  const { data } = await apiClient.patch<FounderSeller>(`/backoffice/founders/${sellerId}`, { founder });
  return data;
}
