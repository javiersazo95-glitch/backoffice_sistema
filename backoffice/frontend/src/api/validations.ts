import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type { ValidationResponse } from '@/types/validation';
import type { AdValidationItem } from '@/types/adValidation';

/** `status` (PENDIENTE|APROBADA|RECHAZADA|POR_CORREGIR) pagina solo esas verificaciones. */
export async function getValidations(page = 0, size = 8, status?: string): Promise<PageResponse<ValidationResponse>> {
  const response = await apiClient.get<PageResponse<ValidationResponse>>('/validations', {
    params: { page, size, status },
  });
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

/**
 * Sin fallback a `GET /anuncios`: esa es la lista PUBLICA (solo publicados). Antes, ante un 403
 * o un 500, el panel de moderacion mostraba esa lista sin pendientes y sin ningun aviso, como si
 * no hubiera nada que moderar. Ahora el error llega a la pantalla.
 */
export async function getAdValidations(): Promise<AdValidationItem[]> {
  const response = await apiClient.get<AdValidationItem[]>('/validations/anuncios');
  return response.data;
}

/** Id numerico del anuncio: el panel a veces lo recibe con prefijo ("AN-12"). */
function adId(id: string | number): string | number {
  return String(id).replace(/\D/g, '') || id;
}

/**
 * Una sola llamada: el backend expone PATCH /validations/anuncios/{id}/approve. Antes se
 * reintentaba con POST y con /anuncios/{id}/approve, asi que un error de negocio (409, 400) se
 * repetia tres veces y el mensaje que veia el operador era el del ultimo intento, no el real.
 */
export async function approveAdValidation(id: string | number): Promise<AdValidationItem> {
  const response = await apiClient.patch<AdValidationItem>(`/validations/anuncios/${adId(id)}/approve`);
  return response.data;
}

export async function rejectAdValidation(id: string | number, reason: string): Promise<AdValidationItem> {
  const response = await apiClient.patch<AdValidationItem>(`/validations/anuncios/${adId(id)}/reject`, { notes: reason, reason });
  return response.data;
}
