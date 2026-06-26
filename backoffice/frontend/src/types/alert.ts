export enum AlertSeverity {
  CRITICA = 'CRITICA',
  ALTA = 'ALTA',
  MEDIA = 'MEDIA',
}

export interface AlertResponse {
  id: number;
  sellerId: number;
  sellerName: string;
  severity: AlertSeverity;
  signalType: string;
  evidence: string;
  impact: string;
  action: string;
  reviewed: boolean;
  reviewedAt: string;
  createdAt: string;
}