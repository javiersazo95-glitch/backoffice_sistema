import apiClient from './client';

/**
 * Chat de soporte de carga de inventario (lado backoffice).
 *
 * El vendedor abre la conversacion desde su panel cuando se traba cargando su inventario; soporte
 * la atiende aqui. Solo el vendedor puede cerrarla y se cierra sola si no responde en 24 horas
 * tras un mensaje de soporte. Endpoints bajo /support/carga-inventario (SUPER_ADMIN u operador de
 * soporte).
 */

export type EstadoChat =
  | 'ESPERANDO_SOPORTE'
  | 'EN_ATENCION'
  | 'ESPERANDO_VENDEDOR'
  | 'CERRADO_POR_VENDEDOR'
  | 'CERRADO_POR_INACTIVIDAD';

/** Estados que soporte puede fijar a mano (nunca uno de cierre). */
export type EstadoChatEditable = 'EN_ATENCION' | 'ESPERANDO_VENDEDOR' | 'ESPERANDO_SOPORTE';

/** Filtro de la bandeja: grupos (abiertos / cerrados) o un estado concreto. */
export type FiltroEstadoChat = 'ABIERTOS' | 'CERRADOS' | EstadoChat;

export type MotivoChat = 'DUDA' | 'ERROR' | 'AYUDA_CARGA' | 'OTRO';

export type AutorMensaje = 'VENDEDOR' | 'SOPORTE' | 'SISTEMA';

export interface MensajeChat {
  id: number;
  autor: AutorMensaje;
  autorNombre: string | null;
  texto: string | null;
  /** Ruta relativa a la API ("/api/v1/uploads/r2/Soporte_carga/..."); exige el token del backoffice. */
  imagenUrl: string | null;
  createdAt: string;
}

/** Contexto que manda el panel del vendedor: donde estaba cuando pidio ayuda. */
export interface ContextoChat {
  flujo?: 'mi-excel' | 'plantilla' | 'otro' | string;
  vista?: string;
  paso?: number;
  pasoTitulo?: string;
  archivoNombre?: string;
  filas?: number;
}

export interface TiendaChat {
  proveedorId: number;
  nombreTienda: string | null;
  rut: string | null;
  email: string | null;
  telefono: string | null;
  contacto: string | null;
}

export interface TarjetaChat {
  id: number;
  tienda: TiendaChat;
  motivo: MotivoChat;
  motivoDetalle: string;
  estado: EstadoChat;
  contexto: ContextoChat | null;
  ultimoMensajePreview: string | null;
  ultimoMensajeAt: string | null;
  ultimoMensajeAutor: AutorMensaje | null;
  /** Mensajes del vendedor que soporte aun no leyo. */
  noLeidos: number;
  atendidoPor: string | null;
  createdAt: string;
  cerradoAt: string | null;
  /** Cuando se cerrara sola si el vendedor no responde (solo en ESPERANDO_VENDEDOR tras un mensaje de soporte). */
  cierreAutomaticoAt: string | null;
}

/** Pagina de la bandeja. Ojo: este endpoint usa page/size, no currentPage/pageSize como PageResponse. */
export interface PaginaChats {
  content: TarjetaChat[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface ResumenChats {
  abiertos: number;
  /** Suma de mensajes sin leer por soporte en conversaciones abiertas. */
  noLeidos: number;
  porEstado: Partial<Record<EstadoChat, number>>;
}

export interface ListChatsParams {
  estado?: FiltroEstadoChat;
  q?: string;
  page?: number;
  size?: number;
}

const BASE = '/support/carga-inventario';

export async function listChats(params: ListChatsParams = {}): Promise<PaginaChats> {
  const response = await apiClient.get<PaginaChats>(`${BASE}/chats`, {
    params: {
      estado: params.estado,
      q: params.q?.trim() || undefined,
      page: params.page ?? 0,
      size: params.size ?? 20,
    },
  });
  return response.data;
}

export async function getResumen(): Promise<ResumenChats> {
  const response = await apiClient.get<ResumenChats>(`${BASE}/resumen`);
  return response.data;
}

export async function getChat(chatId: number): Promise<TarjetaChat> {
  const response = await apiClient.get<TarjetaChat>(`${BASE}/chats/${chatId}`);
  return response.data;
}

/** Mensajes en orden ascendente por id; con despuesDe solo los posteriores a ese id (maximo 200). */
export async function getMensajes(chatId: number, despuesDe?: number): Promise<MensajeChat[]> {
  const response = await apiClient.get<MensajeChat[]>(`${BASE}/chats/${chatId}/mensajes`, {
    params: despuesDe != null ? { despuesDe } : undefined,
  });
  return response.data;
}

export async function sendMensaje(chatId: number, texto: string): Promise<MensajeChat> {
  const response = await apiClient.post<MensajeChat>(`${BASE}/chats/${chatId}/mensajes`, { texto });
  return response.data;
}

export async function sendImagen(chatId: number, file: File, texto?: string): Promise<MensajeChat> {
  const formData = new FormData();
  formData.append('imagen', file);
  const textoLimpio = texto?.trim();
  if (textoLimpio) formData.append('texto', textoLimpio);
  const response = await apiClient.post<MensajeChat>(`${BASE}/chats/${chatId}/imagenes`, formData, {
    headers: { 'Content-Type': undefined },
  });
  return response.data;
}

export async function marcarLeido(chatId: number): Promise<void> {
  await apiClient.post(`${BASE}/chats/${chatId}/leido`);
}

export async function cambiarEstado(chatId: number, estado: EstadoChatEditable): Promise<TarjetaChat> {
  const response = await apiClient.patch<TarjetaChat>(`${BASE}/chats/${chatId}/estado`, { estado });
  return response.data;
}
