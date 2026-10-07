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
  sellerFounder?: boolean;
  orderId: string;
  amount: number;
  status: string;
  priority: TicketPriority;
  /** Texto de vencimiento que arma el backend ("Vence en 2 dias"). Se llama asi en el DTO. */
  dueInformation: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
}
