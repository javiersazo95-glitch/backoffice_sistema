import apiClient from './client';
import type { PageResponse } from '@/types/common';

export interface FounderSeller {
  sellerId: number;
  storeName: string;
  userName: string;
  email: string;
  founder: boolean;
  founderSince?: string | null;
  /** O1: fin del beneficio (3 meses desde la aprobación). */
  founderUntil?: string | null;
  founderDays: number;
  registeredAt: string;
}

/** O1: el beneficio dura `durationMonths` desde la aprobación y solo para las primeras `storeQuota` tiendas. */
export interface FounderConfig {
  founderForNewSellers: boolean;
  durationMonths?: number | null;
  storeQuota?: number | null;
  /** SEC-BACKEND-154: tiendas que ya recibieron el beneficio (consumen el cupo). */
  grantedStores?: number | null;
}

export async function getFounderConfig() {
  const { data } = await apiClient.get<FounderConfig>('/backoffice/founders/config');
  return data;
}

export async function updateFounderConfig(founderForNewSellers: boolean) {
  const { data } = await apiClient.put<FounderConfig>('/backoffice/founders/config', { founderForNewSellers });
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
