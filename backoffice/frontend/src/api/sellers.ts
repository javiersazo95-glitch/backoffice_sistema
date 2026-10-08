import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type {
  SellerResponse,
  SellerDetailResponse,
  SuspendSellerRequest,
  SellerFilterRequest,
  SellerDocumentResponse,
  SellerBlockHistoryResponse,
  SellerRetiroResponse,
  SellerSaleResponse,
  SellerCancellationRate,
  SellerCancellationDetail,
} from '@/types/seller';
import type { TicketResponse } from '@/types/ticket';
import type { ValidationResponse } from '@/types/validation';
import type { ReportResponse } from '@/types/report';

type DocumentLike = Partial<SellerDocumentResponse & ValidationResponse> & Record<string, unknown>;

function normalizeDocumentType(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDocumentUrl(document: DocumentLike): string | undefined {
  return [
    document.documentUrl,
    document.fileUrl,
    document.url,
    document.r2Url,
    document.r2ObjectUrl,
    document.storageUrl,
    document.publicUrl,
    document.downloadUrl,
    typeof document.file === 'object' && document.file ? (document.file as Record<string, unknown>).url : undefined,
    typeof document.r2 === 'object' && document.r2 ? (document.r2 as Record<string, unknown>).url : undefined,
    typeof document.storage === 'object' && document.storage ? (document.storage as Record<string, unknown>).url : undefined,
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function getStringField(document: DocumentLike, key: string, fallback = ''): string {
  const value = document[key];
  return typeof value === 'string' ? value : fallback;
}

function normalizeSellerDocument(document: DocumentLike, sellerId: number): SellerDocumentResponse | null {
  const documentType = getStringField(document, 'documentType')
    || getStringField(document, 'type')
    || getStringField(document, 'name')
    || getStringField(document, 'fileName')
    || getStringField(document, 'title')
    || getStringField(document, 'key');
  if (!documentType) return null;

  return {
    id: typeof document.id === 'number' ? document.id : -Math.abs(normalizeDocumentType(documentType).length + sellerId),
    sellerId: typeof document.sellerId === 'number' ? document.sellerId : sellerId,
    documentType,
    documentUrl: getDocumentUrl(document),
    uploadedAt: getStringField(document, 'uploadedAt') || getStringField(document, 'createdAt'),
    dueAt: getStringField(document, 'dueAt'),
    status: document.status as SellerDocumentResponse['status'],
    owner: getStringField(document, 'owner'),
    notes: getStringField(document, 'notes'),
  };
}

/**
 * Cuanto cancela cada tienda en los ultimos N dias (el backend usa 90 si no se le dice).
 *
 * Trae una fila por tienda CON VENTAS en la ventana, no una por vendedor registrado: las que no
 * vendieron nada no aparecen, y por eso se cruza contra el listado por `proveedorId` en vez de
 * esperar que las dos listas calcen.
 */
export async function getSellerCancellationRates(dias?: number): Promise<SellerCancellationRate[]> {
  const response = await apiClient.get<SellerCancellationRate[]>('/sellers/cancellation-rates', {
    params: dias ? { dias } : undefined,
  });
  return response.data;
}

export async function getSellers(params?: SellerFilterRequest): Promise<PageResponse<SellerResponse>> {
  const response = await apiClient.get<PageResponse<SellerResponse>>('/sellers', { params });
  return response.data;
}

export async function getSellerById(id: number): Promise<SellerDetailResponse> {
  const response = await apiClient.get<SellerDetailResponse>(`/sellers/${id}`);
  return response.data;
}

export async function suspendSeller(id: number, data: SuspendSellerRequest): Promise<SellerResponse> {
  const response = await apiClient.patch<SellerResponse>(`/sellers/${id}/suspend`, data);
  return response.data;
}

export async function getSellerBlockHistory(id: number): Promise<SellerBlockHistoryResponse[]> {
  const response = await apiClient.get<SellerBlockHistoryResponse[]>(`/sellers/${id}/block-history`);
  return response.data;
}

export async function getSellerReports(id: number): Promise<ReportResponse[]> {
  const response = await apiClient.get<ReportResponse[]>(`/sellers/${id}/reports`);
  return response.data;
}

export async function getSellerTickets(id: number): Promise<TicketResponse[]> {
  const response = await apiClient.get<TicketResponse[]>(`/sellers/${id}/tickets`);
  return response.data;
}

export async function getSellerRetiros(id: number): Promise<SellerRetiroResponse[]> {
  const response = await apiClient.get<SellerRetiroResponse[]>(`/sellers/${id}/retiros`);
  return response.data;
}

/** `estado` filtra por el estado de la suborden de la tienda (p. ej. CANCELADO); sin él, todas. */
export async function getSellerSales(id: number, page = 0, size = 5, estado?: string): Promise<PageResponse<SellerSaleResponse>> {
  const response = await apiClient.get<PageResponse<SellerSaleResponse>>(`/sellers/${id}/sales`, {
    params: { page, size, ...(estado ? { estado } : {}) },
  });
  return response.data;
}

/** Las ventas que la tienda canceló en la ventana de la tasa, con motivo y fecha. */
export async function getSellerCancellations(id: number, dias?: number): Promise<SellerCancellationDetail[]> {
  const response = await apiClient.get<SellerCancellationDetail[]>(`/sellers/cancellation-rates/${id}/cancelaciones`, {
    params: dias ? { dias } : undefined,
  });
  return response.data;
}

/**
 * Solo `/sellers/{id}/documents`. Antes ademas bajaba `/validations?size=500` completo en cada
 * apertura para mezclarlo, y el backend ya arma ese listado desde la misma verificacion.
 */
export async function getSellerDocuments(id: number): Promise<SellerDocumentResponse[]> {
  const response = await apiClient.get<SellerDocumentResponse[]>(`/sellers/${id}/documents`);
  return response.data
    .map((document) => normalizeSellerDocument(document as DocumentLike, document.sellerId ?? id))
    .filter((document): document is SellerDocumentResponse => document !== null);
}
