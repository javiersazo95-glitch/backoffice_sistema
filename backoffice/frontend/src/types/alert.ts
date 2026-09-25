import type { RefundPayment } from '@/types/refund';

export enum AlertSeverity {
  CRITICA = 'CRITICA',
  ALTA = 'ALTA',
  MEDIA = 'MEDIA',
}

export interface AlertResponse {
  id: number;
  sellerId: number;
  sellerName: string;
  sellerFounder?: boolean;
  severity: AlertSeverity;
  signalType: string;
  evidence: string;
  impact: string;
  action: string;
  reviewed: boolean;
  reviewedAt: string;
  createdAt: string;
  /** Pruebas de lanzamiento, 25-sep: el reembolso fallido o rechazado al que se refiere la alerta. */
  refundPayment?: RefundPayment | null;
}
