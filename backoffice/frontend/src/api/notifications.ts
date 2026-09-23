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

/** El backend responde `{ count }` (UnreadCountResponseDTO), igual que lo lee el Market. */
export interface UnreadCountResponse {
  count: number;
}

export async function getNotifications(usuarioId: number): Promise<NotificacionItem[]> {
  const res = await apiClient.get<NotificacionItem[]>(`/usuarios/${usuarioId}/notificaciones`);
  return res.data;
}

export async function getUnreadCount(usuarioId: number): Promise<number> {
  const res = await apiClient.get<UnreadCountResponse>(`/usuarios/${usuarioId}/notificaciones/unread-count`);
  // Antes leía `unreadCount`, que no existe: la query devolvía undefined, la campana quedaba
  // siempre en 0 y React Query registraba un error de consola cada 30 s.
  return Number(res.data?.count ?? 0);
}

export async function markAsRead(usuarioId: number, notificacionId: number): Promise<void> {
  await apiClient.put(`/usuarios/${usuarioId}/notificaciones/${notificacionId}/leida`);
}

export async function markAllAsRead(usuarioId: number): Promise<void> {
  await apiClient.put(`/usuarios/${usuarioId}/notificaciones/leidas`);
}