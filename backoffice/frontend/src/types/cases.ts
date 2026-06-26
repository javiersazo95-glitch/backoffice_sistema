export interface RiskCase {
  id: string;
  sellerId: number;
  seller: string;
  status: 'Esperando al vendedor';
  reason: string;
  orderId: string;
  updated: string;
  stage: string;
  owner: string;
  purchase?: string;
  buyer?: string;
}

export interface ImpactMediation {
  id: string;
  sellerId: number;
  seller: string;
  status: 'En mediación';
  reason: string;
  escalationReason?: string;
  orderId: string;
  amount: string;
  updated: string;
  owner: string;
  stage: string;
  nextAction?: string;
  accountBlocked?: boolean;
  purchase?: string;
  buyer?: string;
}

export interface ResolvedCase {
  id: string;
  sellerId: number;
  seller: string;
  caseId: string;
  kind: string;
  reason: string;
  orderId: string;
  resolvedDate: string;
  resolvedBy: string;
  resolutionReason: string;
  documentName?: string;
  sourceStatus: string;
}
