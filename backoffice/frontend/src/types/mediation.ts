import type { MediationNoteType } from '@/utils/mediationNotes';

export enum MediationStatus {
  ESPERANDO_VENDEDOR = 'ESPERANDO_VENDEDOR',
  ESCALADO = 'ESCALADO',
  EN_MEDIACION = 'EN_MEDIACION',
  RESUELTA = 'RESUELTA',
  CERRADA = 'CERRADA',
}

export interface MediationResponse {
  id: number;
  externalId: string;
  sellerId: number;
  sellerName: string;
  title: string;
  status: MediationStatus;
  displayStatus: string;
  elapsed: string;
  escalationType: string;
  escalationReason: string;
  orderId: string;
  reason: string;
  amount: number;
  stage: string;
  owner: string;
  nextAction: string;
  mediationStarted: boolean;
  accountBlocked: boolean;
  blockedAccountStatus?: string;
  canBlockAccount: boolean;
  blockingMediationId?: number | null;
  blockingMediationExternalId?: string | null;
  createdAt: string;
  updatedAt: string;
  buyer?: string;
}

export interface MediationDetailResponse extends MediationResponse {
  messages: MediationMessageResponse[];
  buyerMessages?: MediationMessageResponse[];
  sellerMessages?: MediationMessageResponse[];
  buyerEvidence?: MediationEvidenceResponse[];
  sellerEvidence?: MediationEvidenceResponse[];
  resolutionReason: string;
  documentName: string;
  documentUrl: string;
  documentType: string;
  buyer: string;
  buyerPhotoUrl?: string | null;
  sellerPhotoUrl?: string | null;
}

export interface MediationEvidenceResponse {
  id: string;
  url: string;
  fileName?: string;
  mimeType?: string;
  actorRole?: string;
  source?: string;
  uploadedByUserId?: number | null;
  uploadedAt?: string;
}

export interface MediationMessageResponse {
  id: number;
  author: string;
  text: string;
  noteType?: MediationNoteType;
  type?: string;
  senderRole?: string;
  targetRole?: string;
  closed?: boolean;
  internal?: boolean;
  senderUserId?: number | null;
  editedAt: string;
  createdAt: string;
}

export interface MediationSummaryResponse {
  id: number;
  externalId: string;
  title: string;
  status: MediationStatus;
  reason: string;
  orderId: string;
  amount: number;
  updatedAt: string;
}

export interface ResolvedCaseResponse {
  id: number;
  externalId: string;
  caseKind: string;
  mediationId: number;
  sellerId: number;
  sellerName: string;
  buyer: string;
  orderId: string;
  reason: string;
  amount: string;
  resolutionReason: string;
  documentName: string;
  documentUrl: string;
  documentType: string;
  resolvedBy: string;
  sourceStatus: string;
  createdAt: string;
}

export interface InitMediationRequest {
  sellerId: number;
  title: string;
  reason: string;
  orderId: string;
  amount: string;
  escalationReason?: string;
  message: string;
}

export interface MediationMessageRequest {
  message: string;
  type?: string;
  targetRole?: string;
  isInternal?: boolean;
}

export interface ResolveCaseRequest {
  resolutionReason: string;
  mode?: string;
}

export interface MediationFilterRequest {
  search?: string;
  status?: MediationStatus;
  blocked?: boolean;
  activeOnly?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}
