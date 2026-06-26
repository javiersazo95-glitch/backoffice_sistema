import { TrustLevel } from './seller';

export interface DashboardSummaryResponse {
  activeSellers: number;
  pendingValidation: number;
  openMediations: number;
  sellerRisks: number;
  criticalAlerts: number;
  suspendedSellers: number;
  expiringDocuments: number;
  unansweredClaims: number;
  validationsPending: number;
  validationsApproved: number;
  validationsRejected: number;
  validationsCorrection: number;
  receiptFollowups: number;
  trustScore: number;
  trustLevel: TrustLevel;
}