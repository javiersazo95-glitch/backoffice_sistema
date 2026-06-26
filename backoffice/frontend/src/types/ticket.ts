export enum TicketStatus {
  ABIERTO = 'ABIERTO',
  EN_PROCESO = 'EN_PROCESO',
  PENDIENTE_VENDEDOR = 'PENDIENTE_VENDEDOR',
  PENDIENTE_COMPRADOR = 'PENDIENTE_COMPRADOR',
  SLA_VENCIDO = 'SLA_VENCIDO',
  RESUELTO = 'RESUELTO',
  CERRADO = 'CERRADO',
  CANCELADO = 'CANCELADO',
}

export enum TicketPriority {
  CRITICA = 'CRITICA',
  ALTA = 'ALTA',
  MEDIA = 'MEDIA',
  BAJA = 'BAJA',
}

export interface TicketResponse {
  id: number;
  externalId: string;
  sellerId: number;
  status: TicketStatus;
  priority: TicketPriority;
  sla: string;
  reason: string;
  orderId: string;
  lastMessage: string;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
}