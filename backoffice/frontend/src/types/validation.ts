export enum ValidationStatus {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  POR_CORREGIR = 'POR_CORREGIR',
}

export interface ValidationResponse {
  /** Id sintetico del documento (verificationId*10+sub). Para aprobar/corregir/rechazar usar verificationId. */
  id: number;
  /** Id real de la verificacion del proveedor; lo expone el backend desde la auditoria de ids. */
  verificationId?: number;
  sellerId: number;
  sellerName: string;
  sellerFounder?: boolean;
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

