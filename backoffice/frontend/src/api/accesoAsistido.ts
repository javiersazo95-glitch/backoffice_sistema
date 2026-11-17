import apiClient from './client';

/**
 * Acceso asistido (17-nov): Mediación y Confianza entra al panel de un vendedor como INVITADO, con su permiso y
 * por un tiempo acotado, solo para cargar repuestos. Espejo de AccesoAsistidoDTOs del backend.
 */

export type NivelAcceso = 'BASICO' | 'MEDIO' | 'COMPLETO';

export type EstadoAcceso =
  | 'PENDIENTE_VENDEDOR'
  | 'PENDIENTE_SOPORTE'
  | 'ACTIVO'
  | 'RECHAZADO'
  | 'REVOCADO'
  | 'EXPIRADO'
  | 'CANCELADO'
  | 'FINALIZADO';

export interface EventoAcceso {
  id: number;
  tipo: string;
  actorNombre: string;
  /** JSON con el detalle (sku, nombre, precio antes/después, cargaId...), o null. */
  detalle: string | null;
  creadoEn: string;
}

export interface AccesoAsistido {
  id: number;
  proveedorId: number;
  tiendaNombre: string;
  origen: 'SOPORTE' | 'VENDEDOR';
  estado: EstadoAcceso;
  nivelSolicitado: NivelAcceso;
  nivel: NivelAcceso | null;
  duracionHoras: number | null;
  justificacion: string | null;
  adjuntoUrl: string | null;
  solicitadoPorNombre: string | null;
  operadorId: number | null;
  operadorNombre: string | null;
  creadoEn: string;
  solicitudExpiraEn: string;
  autorizadoEn: string | null;
  iniciaEn: string | null;
  expiraEn: string | null;
  cerradoEn: string | null;
  comentarioRechazo: string | null;
  resumen: { productosCreados: number; preciosActualizados: number; cargasExcel: number };
  eventos: EventoAcceso[] | null;
  /** Detalle de lo que cambió soporte (backend: AccesoAsistidoDTOs.Cambios). Puede faltar en accesos viejos. */
  cambios?: CambiosAcceso | null;
  serverTime: string;
}

export interface RepuestoCreado {
  productoId: number | null;
  sku: string | null;
  nombre: string | null;
  precio: number | null;
  desdeExcel: boolean;
  /** El vendedor lo borró después; queda lo registrado al crearlo. */
  eliminado: boolean;
  creadoEn: string | null;
}

export interface PrecioCambiado {
  productoId: number | null;
  sku: string | null;
  nombre: string | null;
  precioAntes: number | null;
  precioDespues: number | null;
  cambiadoEn: string | null;
}

export interface CargaExcel {
  cargaId: number | null;
  archivo: string | null;
  filas: number;
  cargados: number;
  conError: number;
  cargadoEn: string | null;
}

export interface CambiosAcceso {
  /** Los más recientes; `totalCreados` cuenta todos. */
  creados: RepuestoCreado[];
  totalCreados: number;
  precios: PrecioCambiado[];
  cargas: CargaExcel[];
}

export interface DetalleAcceso {
  actual: AccesoAsistido | null;
  historial: AccesoAsistido[];
  serverTime: string;
}

/** Una tienda con solicitud viva: alimenta el icono de cada fila de la tabla de vendedores. */
export interface ResumenTiendaAcceso {
  proveedorId: number;
  accesoId: number;
  estado: EstadoAcceso;
  origen: 'SOPORTE' | 'VENDEDOR';
  nivel: NivelAcceso | null;
  operadorId: number | null;
  solicitudExpiraEn: string;
  expiraEn: string | null;
}

export interface ResumenAccesos {
  tiendas: ResumenTiendaAcceso[];
  serverTime: string;
}

const BASE = '/sellers/acceso-asistido';

export async function getResumenAccesos(): Promise<ResumenAccesos> {
  const response = await apiClient.get<ResumenAccesos>(`${BASE}/resumen`);
  return response.data;
}

export async function getDetalleAcceso(proveedorId: number): Promise<DetalleAcceso> {
  const response = await apiClient.get<DetalleAcceso>(`${BASE}/proveedores/${proveedorId}`);
  return response.data;
}

export async function solicitarAcceso(proveedorId: number, datos: { nivel: NivelAcceso; motivo: string }): Promise<AccesoAsistido> {
  const response = await apiClient.post<AccesoAsistido>(`${BASE}/proveedores/${proveedorId}/solicitar`, datos);
  return response.data;
}

export async function reenviarCorreoAcceso(accesoId: number): Promise<AccesoAsistido> {
  const response = await apiClient.post<AccesoAsistido>(`${BASE}/${accesoId}/reenviar`);
  return response.data;
}

export async function cancelarAcceso(accesoId: number): Promise<AccesoAsistido> {
  const response = await apiClient.post<AccesoAsistido>(`${BASE}/${accesoId}/cancelar`);
  return response.data;
}

/** Acepta la solicitud que hizo el vendedor: ahí parte el contador. */
export async function aceptarSolicitudVendedor(accesoId: number): Promise<AccesoAsistido> {
  const response = await apiClient.post<AccesoAsistido>(`${BASE}/${accesoId}/aceptar`);
  return response.data;
}

/** Ticket de un solo uso (60 s) con que el panel del vendedor abre la sesión de invitado. */
export async function emitirTicketAcceso(accesoId: number): Promise<{ ticket: string; estado: EstadoAcceso }> {
  const response = await apiClient.post<{ ticket: string; estado: EstadoAcceso }>(`${BASE}/${accesoId}/ticket`);
  return response.data;
}
