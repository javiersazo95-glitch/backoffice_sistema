import { TrustLevel } from './seller';

export interface DashboardSummaryResponse {
  activeSellers: number;
  /** @deprecated Mismo valor que `validationsPending`. */
  pendingValidation?: number;
  openMediations: number;
  /** Alertas sin revisar (todas las severidades). */
  sellerRisks: number;
  /** Alertas CRITICA sin revisar. */
  criticalAlerts: number;
  suspendedSellers: number;
  /** @deprecated El backend lo fija en 0. */
  expiringDocuments?: number;
  /** @deprecated Mismo valor que `openMediations`. */
  unansweredClaims?: number;
  validationsPending: number;
  validationsApproved: number;
  validationsRejected: number;
  validationsCorrection: number;
  /** Boletas de venta en seguimiento PENDIENTE. */
  receiptFollowups: number;
  trustScore: number;
  trustLevel: TrustLevel;
  // Claves de urgencia: las agrega el backend nuevo; mientras no lleguen se calculan en el navegador.
  mediationsOver2Days?: number;
  mediationsOver5Days?: number;
  validationsPendingOver3Days?: number;
  alertsUnreviewedCritica?: number;
  alertsUnreviewedAlta?: number;
  alertsUnreviewedMedia?: number;
  receiptsOverdue?: number;
  reportsToday?: number;
}
