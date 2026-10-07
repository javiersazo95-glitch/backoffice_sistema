import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type { ReceiptFollowupResponse } from '@/types/receipt';

/** Sin `status` el backend devuelve solo PENDIENTE, ordenado por vencimiento. */
export async function getReceipts(page = 0, size = 8, status?: string): Promise<PageResponse<ReceiptFollowupResponse>> {
  const response = await apiClient.get<PageResponse<ReceiptFollowupResponse>>('/receipts', {
    params: { page, size, status },
  });
  return response.data;
}

export async function resolveReceipt(id: number): Promise<ReceiptFollowupResponse> {
  const response = await apiClient.patch<ReceiptFollowupResponse>(`/receipts/${id}/resolve`);
  return response.data;
}