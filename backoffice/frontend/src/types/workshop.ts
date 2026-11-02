import type { ReportResponse } from './report';

/** Estado de la acreditacion del taller (RT_servicio_automotriz.estado). */
export type WorkshopStatus = 'SIN_SOLICITUD' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'POR_CORREGIR' | string;

export interface WorkshopSummary {
  /** Id de la cuenta (usuario) del taller. */
  id: number;
  nombreNegocio: string;
  rut: string;
  responsable: string;
  email: string;
  telefono?: string;
  region?: string;
  comuna?: string;
  direccion?: string;
  estado: WorkshopStatus;
  cuentaActiva: boolean;
  userProfileUrl?: string;
  reportes: number;
  diagnosticos: number;
  comentarios: number;
  necesidades: number;
  opiniones: number;
  calificacion?: number | null;
  createdAt?: string;
  ultimaActividad?: string;
}

/** Diagnostico privado o comentario publico que el taller dejo en una falla automotriz. */
export interface WorkshopDiagnostic {
  id: number;
  fallaId: number;
  fallaTitulo: string;
  vehiculo: string;
  texto: string;
  precioDesde?: number | null;
  precioHasta?: number | null;
  aceptado: boolean;
  tipo: 'DIAGNOSTICO' | 'COMENTARIO';
  createdAt: string;
}

export interface WorkshopPurchaseNeed {
  id: number;
  repuesto: string;
  vehiculo: string;
  patente?: string;
  cantidad: number;
  estado: 'ACTIVA' | 'FINALIZADA' | 'EXPIRADA' | 'CANCELADA' | string;
  cotizaciones: number;
  motivoCancelacion?: string;
  createdAt: string;
  fechaLimite?: string;
}

export interface WorkshopDocument {
  /** Tipo de la ruta de descarga: identidad, inicio-actividades o patente-municipal. */
  tipo: string;
  etiqueta: string;
  /** Null si el taller aun no sube el documento. */
  nombre?: string | null;
}

export interface WorkshopDetail {
  /** Id del expediente; es el que usa la descarga de documentos. */
  servicioId: number;
  documentos: WorkshopDocument[];
  resumen: WorkshopSummary;
  notasRevision?: string;
  documentosCompletos: boolean;
  atiende24Horas: boolean;
  permiteReservas: boolean;
  servicioDomicilio: boolean;
  submittedAt?: string;
  reviewedAt?: string;
  diagnosticos: WorkshopDiagnostic[];
  comentarios: WorkshopDiagnostic[];
  necesidades: WorkshopPurchaseNeed[];
  reportes: ReportResponse[];
}
