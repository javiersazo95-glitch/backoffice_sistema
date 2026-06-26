export enum ValidationStatus {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
}

export interface ValidationResponse {
  id: number;
  sellerId: number;
  sellerName: string;
  documentType: string;
  documentUrl?: string;
  uploadedAt: string;
  dueAt: string;
  status: ValidationStatus;
  owner: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateValidationRequest {
  sellerId: number;
  documentType: string;
  dueAt: string;
  notes?: string;
}
