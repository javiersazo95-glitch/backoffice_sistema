import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type { SaleReceiptCompliance } from '@/types/saleReceipt';

export interface SaleReceiptFilters {
  conBoleta?: boolean | null;
  proveedorId?: number | null;
  desde?: string | null;
  hasta?: string | null;
  page?: number;
  size?: number;
}

export async function getSaleReceipts(filters: SaleReceiptFilters = {}): Promise<PageResponse<SaleReceiptCompliance>> {
  const { conBoleta, proveedorId, desde, hasta, page = 0, size = 20 } = filters;
  const response = await apiClient.get<PageResponse<SaleReceiptCompliance>>('/administration/sale-receipts', {
    // Los nulos se omiten: el backend trata "sin filtro" como parametro ausente, y mandar
    // `conBoleta=null` lo dejaria filtrando por un valor que no existe.
    params: {
      ...(conBoleta === true || conBoleta === false ? { conBoleta } : {}),
      ...(proveedorId ? { proveedorId } : {}),
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
      page,
      size,
    },
  });
  return response.data;
}

/**
 * URL de descarga de un solo uso (5 minutos) para la boleta de esa subordén. Cada llamada
 * emite un token nuevo: el anterior se gasta al usarlo.
 */
export async function getSaleReceiptUrl(subordenId: number): Promise<string> {
  const response = await apiClient.get<{ url: string }>(`/administration/sale-receipts/${subordenId}/url`);
  return response.data.url;
}
