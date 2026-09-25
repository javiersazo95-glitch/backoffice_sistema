import type { MediationNoteType } from '@/utils/mediationNotes';
import type { RefundPayment } from '@/types/refund';

export enum MediationStatus {
  EN_MEDIACION = 'EN_MEDIACION',
  RESUELTA = 'RESUELTA',
  CERRADA = 'CERRADA',
}

export interface MediationResponse {
  id: number;
  externalId: string;
  sellerId: number;
  sellerName: string;
  sellerFounder?: boolean;
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
  resolucionFavor?: 'COMPRADOR' | 'VENDEDOR' | null;
  resolucionOpcion?: string | null;
  porcentajeReembolso?: number | null;
  montoReembolso?: number | null;
  estadoReembolso?: string | null;
  suspensionTarget?: 'COMPRADOR' | 'VENDEDOR' | null;
  suspensionDuracion?: string | null;
  suspensionFechaFin?: string | null;
  suspensionPuedeApelar?: boolean | null;
  suspensionMotivo?: string | null;
  suspensionDetalle?: string | null;
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
  buyerProfileImageUrl?: string | null;
  sellerProfileImageUrl?: string | null;
  buyerProfileUrl?: string | null;
  sellerProfileUrl?: string | null;
  buyerUserProfileUrl?: string | null;
  sellerUserProfileUrl?: string | null;
  buyerAvatarUrl?: string | null;
  sellerAvatarUrl?: string | null;
  profileImageUrl?: string | null;
  userProfileUrl?: string | null;
  avatarUrl?: string | null;
  /** Pruebas de lanzamiento, 25-sep: el Pago del reembolso por esta mediación (reintentar / devolución manual). */
  refundPayment?: RefundPayment | null;
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
  sellerFounder?: boolean;
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
  resolucionFavor?: 'COMPRADOR' | 'VENDEDOR' | null;
  resolucionOpcion?: string | null;
  porcentajeReembolso?: number | null;
  montoReembolso?: number | null;
  estadoReembolso?: string | null;
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
  /** Solo lo usa la reactivación de cuenta; al resolver, el veredicto genera el texto. */
  resolutionReason?: string;
  mode?: string;
  /** Veredicto: a favor de quién se resuelve. Obligatorio al resolver (no en reactivación). */
  favor?: 'COMPRADOR' | 'VENDEDOR';
  /** Key del catálogo de figuras de la Ley 19.496 (ver utils/mediationResolution). */
  resolutionOption?: string;
  /** Porcentaje del subtotal de la tienda a reembolsar (1–100). Solo en reembolso parcial. */
  refundPercentage?: number;
}

export interface MediationVerdictFields {
  resolucionFavor?: 'COMPRADOR' | 'VENDEDOR' | null;
  resolucionOpcion?: string | null;
  porcentajeReembolso?: number | null;
  montoReembolso?: number | null;
  estadoReembolso?: string | null;
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

export type SuspensionDuration =
  | '3_DIAS'
  | '7_DIAS'
  | '15_DIAS'
  | '1_MES'
  | '3_MESES'
  | 'INDEFINIDO';

export interface MediationSuspendPayload {
  targetRole: 'COMPRADOR' | 'VENDEDOR';
  duration: SuspensionDuration;
  reason: string;
  details?: string;
}

