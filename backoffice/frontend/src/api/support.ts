import apiClient from './client';
import type { PageResponse } from '@/types/common'; // Aseguramos usar tipos del backoffice

export type TicketCategory = 'FALLA_TECNICA' | 'SOLICITUD_AYUDA' | 'CONSULTA';
export type ReporterType = 'COMPRADOR' | 'VENDEDOR' | 'INTERNO';
export type TicketPriority = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
export type TicketPlatform = 'ADMINISTRACION_CONTABLE' | 'MEDIACION_CONFIANZA' | 'APP_MOBILE';
export type TicketStatus =
  | 'ABIERTO'
  | 'EN_PROCESO'
  | 'PENDIENTE_VENDEDOR'
  | 'PENDIENTE_COMPRADOR'
  | 'SLA_VENCIDO'
  | 'RESUELTO'
  | 'CERRADO'
  | 'CANCELADO';

export interface SupportWorkspaceResponse {
  module: string;
  status: string;
  views: string[];
  newTickets: number;
  openTickets: number;
  urgentTickets: number;
  expiredSlaTickets: number; // Mapeado a tickets resueltos en el backend
  totalTickets: number;
  technicalFailureTickets: number;
  helpRequestTickets: number;
  inquiryTickets: number;
  buyerReporterTickets: number;
  sellerReporterTickets: number;
  internalReporterTickets: number;
  accountingPlatformTickets: number;
  trustPlatformTickets: number;
  mobilePlatformTickets: number;
}

export interface TicketResponse {
  id: number;
  externalId: string;
  sellerId?: number;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  reporterType: ReporterType;
  platform?: TicketPlatform;
  reporterName: string;
  sla?: string;
  reason: string;
  orderId?: string;
  lastMessage?: string;
  nextAction?: string;
  supportResponse?: string;
  responseRead?: boolean;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: number;
  autorTipo: 'USUARIO' | 'SOPORTE';
  autorNombre?: string;
  mensaje: string;
  createdAt: string;
}

export interface GetTicketsParams {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  platform?: TicketPlatform;
  page?: number;
  size?: number;
}

export interface CreateTicketData {
  reason: string;
  lastMessage: string;
  category: TicketCategory;
  priority: TicketPriority;
  reporterType: ReporterType;
  reporterName: string;
  sellerId?: number | null;
  platform?: TicketPlatform | null;
}

export interface UpdateTicketStatusData {
  status: TicketStatus;
  nextAction?: string;
}

export async function getWorkspace(): Promise<SupportWorkspaceResponse> {
  const response = await apiClient.get<SupportWorkspaceResponse>('/support/workspace');
  return response.data;
}

export async function getTickets(params?: GetTicketsParams): Promise<PageResponse<TicketResponse>> {
  const response = await apiClient.get<PageResponse<TicketResponse>>('/support/tickets', { params });
  return response.data;
}

export async function getTicketById(id: number): Promise<TicketResponse> {
  const response = await apiClient.get<TicketResponse>(`/support/tickets/${id}`);
  return response.data;
}

export async function createTicket(data: CreateTicketData): Promise<TicketResponse> {
  const response = await apiClient.post<TicketResponse>('/support/tickets', data);
  return response.data;
}

export async function updateTicketStatus(id: number, data: UpdateTicketStatusData): Promise<TicketResponse> {
  const response = await apiClient.patch<TicketResponse>(`/support/tickets/${id}/status`, data);
  return response.data;
}

export async function getTicketMessages(ticketId: number): Promise<TicketMessage[]> {
  const response = await apiClient.get<TicketMessage[]>(`/support/tickets/${ticketId}/messages`);
  return response.data;
}

export async function sendTicketMessage(ticketId: number, data: { autorTipo: string; autorNombre?: string; mensaje: string }): Promise<TicketMessage> {
  const response = await apiClient.post<TicketMessage>(`/support/tickets/${ticketId}/messages`, data);
  return response.data;
}
