export enum SellerStatus {
  APROBADO = 'APROBADO',
  POR_CORREGIR = 'POR_CORREGIR',
  RECHAZADO = 'RECHAZADO',
}

export enum TrustLevel {
  ALTO = 'ALTO',
  MEDIO = 'MEDIO',
  BAJO = 'BAJO',
}

export enum BankStatus {
  VERIFICADA = 'VERIFICADA',
  PENDIENTE = 'PENDIENTE',
  BLOQUEADA = 'BLOQUEADA',
}

export interface SellerResponse {
  id: number;
  externalId: string;
  storeName: string;
  rut: string;
  city: string;
  status: SellerStatus;
  trustLevel: TrustLevel;
  trustScore: number;
  rating: number;
  responseTime: string;
  openTickets: number;
  mediationCount: number;
  returnsCount: number;
  claimsCount: number;
  pendingReceipts: number;
  documentsSummary: string;
  bankStatus: BankStatus;
  lastActivityAt: string;
  address?: string;
  email?: string;
  phone?: string;
  cargo?: string;
  owner?: string;
  userProfileUrl?: string | null;
  // Cuenta bancaria real del vendedor
  bankName?: string | null;
  bankAccountHolderName?: string | null;
  bankAccountRut?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountUpdatedAt?: string | null;
}

export interface SellerDetailResponse extends SellerResponse {
  documents: SellerDocumentResponse[];
  tickets: import('./ticket').TicketResponse[];
  mediations: import('./mediation').MediationSummaryResponse[];
  risks: import('./alert').AlertResponse[];
}

export interface SellerBlockHistoryResponse {
  id: string;
  sellerId: number;
  mediationId?: number | null;
  externalId?: string | null;
  action: string;
  reason?: string | null;
  detail?: string | null;
  operator?: string | null;
  status?: string | null;
  source: string;
  createdAt: string;
}

export interface SellerDocumentResponse {
  id: number;
  sellerId: number;
  documentType: string;
  documentUrl?: string;
  uploadedAt: string;
  dueAt: string;
  status: import('./validation').ValidationStatus;
  owner: string;
  notes: string;
}

export interface SellerFilterRequest {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}

export interface CreateSellerRequest {
  storeName: string;
  rut: string;
  city: string;
}

export interface UpdateSellerRequest {
  storeName?: string;
  city?: string;
  trustLevel?: TrustLevel;
  trustScore?: number;
  rating?: number;
  bankStatus?: BankStatus;
  documentsSummary?: string;
}

export interface SuspendSellerRequest {
  reason: string;
}
