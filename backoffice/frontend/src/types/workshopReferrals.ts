/** Seguimiento de la captación por referidos de los talleres (`GET /sellers/workshops/referidos`). */
export interface WorkshopReferralSummary {
  /** Id de la cuenta (usuario) del taller. */
  id: number;
  servicioId: number;
  nombreNegocio: string;
  email: string;
  region?: string | null;
  comuna?: string | null;
  estado: string;
  /** null si el taller nunca abrió su código QR. */
  codigo: string | null;
  /** Compradores que ya cuentan (correo verificado). */
  registrados: number;
  /** Se registraron con su código pero aún no verifican el correo. */
  pendientes: number;
  porPremio: number;
  /** Compradores que faltan para el próximo periodo gratis. */
  paraProximo: number;
  periodosGanados: number;
  diasGanados: number;
  ultimoReferidoEn?: string | null;
}

export interface WorkshopReferralTotals {
  talleresConCodigo: number;
  talleresConReferidos: number;
  compradoresRegistrados: number;
  compradoresPendientes: number;
  talleresConMeta: number;
  periodosGanados: number;
  diasGanados: number;
  porPremio: number;
  diasPorPeriodo: number;
}

export interface WorkshopReferralList {
  totales: WorkshopReferralTotals;
  talleres: WorkshopReferralSummary[];
}

/** Un comprador que se registró con el código del taller; `contadoEn` es null mientras no verifica su correo. */
export interface WorkshopReferralBuyer {
  usuarioId: number;
  nombre: string;
  email?: string | null;
  canal: string;
  registradoEn: string;
  contadoEn?: string | null;
}

export interface WorkshopReferralDetail {
  resumen: WorkshopReferralSummary;
  compradores: WorkshopReferralBuyer[];
}
