import apiClient from './client';

export interface NotificacionItem {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  targetRoute?: string | null;
  targetParams?: Record<string, string> | null;
  leida: boolean;
  createdAt: string;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export async function getNotifications(usuarioId: number): Promise<NotificacionItem[]> {
  const res = await apiClient.get<NotificacionItem[]>(`/usuarios/${usuarioId}/notificaciones`);
  return res.data;
}

export async function getUnreadCount(usuarioId: number): Promise<number> {
  const res = await apiClient.get<UnreadCountResponse>(`/usuarios/${usuarioId}/notificaciones/unread-count`);
  return res.data.unreadCount;
}

export async function markAsRead(usuarioId: number, notificacionId: number): Promise<void> {
  await apiClient.put(`/usuarios/${usuarioId}/notificaciones/${notificacionId}/leida`);
}

export async function markAllAsRead(usuarioId: number): Promise<void> {
  await apiClient.put(`/usuarios/${usuarioId}/notificaciones/leidas`);
}