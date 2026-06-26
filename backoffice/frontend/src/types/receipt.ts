import { TicketPriority } from './ticket';

export enum ReceiptFollowupStatus {
  PENDIENTE = 'PENDIENTE',
  RESUELTO = 'RESUELTO',
}

export interface ReceiptFollowupResponse {
  id: number;
  externalId: string;
  sellerId: number;
  sellerName: string;
  orderId: string;
  amount: string;
  status: string;
  priority: TicketPriority;
  dueInfo: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
}