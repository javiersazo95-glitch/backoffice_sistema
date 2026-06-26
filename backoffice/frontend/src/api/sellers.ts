import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type {
  SellerResponse,
  SellerDetailResponse,
  CreateSellerRequest,
  UpdateSellerRequest,
  SuspendSellerRequest,
  SellerFilterRequest,
  SellerDocumentResponse,
} from '@/types/seller';
import type { TicketResponse } from '@/types/ticket';
import type { ValidationResponse } from '@/types/validation';

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

function mergeSellerDocuments(
  sellerDocuments: SellerDocumentResponse[],
  validationDocuments: ValidationResponse[],
): SellerDocumentResponse[] {
  const merged = new Map<string, SellerDocumentResponse>();

  sellerDocuments.forEach((document) => {
    const normalizedDocument = normalizeSellerDocument(document as DocumentLike, document.sellerId);
    if (normalizedDocument) {
      merged.set(normalizeDocumentType(normalizedDocument.documentType), normalizedDocument);
    }
  });

  validationDocuments.forEach((document) => {
    const normalizedDocument = normalizeSellerDocument(document as DocumentLike, document.sellerId);
    if (normalizedDocument) {
      const key = normalizeDocumentType(normalizedDocument.documentType);
      const current = merged.get(key);
      if (!current || (!current.documentUrl && normalizedDocument.documentUrl)) {
        merged.set(key, normalizedDocument);
      }
    }
  });

  return Array.from(merged.values());
}

export async function getSellers(params?: SellerFilterRequest): Promise<PageResponse<SellerResponse>> {
  const response = await apiClient.get<PageResponse<SellerResponse>>('/sellers', { params });
  return response.data;
}

export async function getSellerById(id: number): Promise<SellerDetailResponse> {
  const response = await apiClient.get<SellerDetailResponse>(`/sellers/${id}`);
  return response.data;
}

export async function createSeller(data: CreateSellerRequest): Promise<SellerResponse> {
  const response = await apiClient.post<SellerResponse>('/sellers', data);
  return response.data;
}

export async function updateSeller(id: number, data: UpdateSellerRequest): Promise<SellerResponse> {
  const response = await apiClient.patch<SellerResponse>(`/sellers/${id}`, data);
  return response.data;
}

export async function suspendSeller(id: number, data: SuspendSellerRequest): Promise<SellerResponse> {
  const response = await apiClient.patch<SellerResponse>(`/sellers/${id}/suspend`, data);
  return response.data;
}

export async function getSellerTickets(id: number): Promise<TicketResponse[]> {
  const response = await apiClient.get<TicketResponse[]>(`/sellers/${id}/tickets`);
  return response.data;
}

export async function getSellerDocuments(id: number): Promise<SellerDocumentResponse[]> {
  const response = await apiClient.get<SellerDocumentResponse[]>(`/sellers/${id}/documents`);

  try {
    const validationsResponse = await apiClient.get<PageResponse<ValidationResponse>>('/validations', {
      params: { page: 0, size: 500 },
    });
    const sellerValidations = validationsResponse.data.content.filter((document) => document.sellerId === id);
    return mergeSellerDocuments(response.data, sellerValidations);
  } catch {
    return response.data;
  }
}
