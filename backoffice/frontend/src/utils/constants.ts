export const API_URLS = {
  AUTH: {
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
  },
  SELLERS: {
    LIST: '/sellers',
    DETAIL: (id: number) => `/sellers/${id}`,
    CREATE: '/sellers',
    UPDATE: (id: number) => `/sellers/${id}`,
    SUSPEND: (id: number) => `/sellers/${id}/suspend`,
    TICKETS: (id: number) => `/sellers/${id}/tickets`,
    DOCUMENTS: (id: number) => `/sellers/${id}/documents`,
  },
  MEDIATIONS: {
    LIST: '/mediations',
    DETAIL: (id: number) => `/mediations/${id}`,
    CREATE: '/mediations',
    INIT: (id: number) => `/mediations/${id}/init`,
    BLOCK_ACCOUNT: (id: number) => `/mediations/${id}/block-account`,
    RESOLVE: (id: number) => `/mediations/${id}/resolve`,
    REACTIVATE: (id: number) => `/mediations/${id}/reactivate`,
    MESSAGES: (id: number) => `/mediations/${id}/messages`,
    MESSAGE: (id: number, messageId: number) => `/mediations/${id}/messages/${messageId}`,
  },
  VALIDATIONS: {
    LIST: '/validations',
    DETAIL: (id: number) => `/validations/${id}`,
    CREATE: '/validations',
    APPROVE: (id: number) => `/validations/${id}/approve`,
    REQUEST_CORRECTION: (id: number) => `/validations/${id}/request-correction`,
    REJECT: (id: number) => `/validations/${id}/reject`,
  },
  ALERTS: {
    LIST: '/alerts',
    REVIEW: (id: number) => `/alerts/${id}/review`,
    ESCALATE: (id: number) => `/alerts/${id}/escalate`,
  },
  DASHBOARD: {
    SUMMARY: '/dashboard/summary',
  },
  AUDITS: {
    LIST: '/audits',
    DETAIL: (id: number) => `/audits/${id}`,
  },
  RECEIPTS: {
    LIST: '/receipts',
    RESOLVE: (id: number) => `/receipts/${id}/resolve`,
  },
} as const;

export const PAGE_SIZES = {
  SELLERS: 5,
  MEDIATIONS: 8,
  VALIDATIONS: 8,
  ALERTS: 8,
  AUDITS: 6,
  RECEIPTS: 8,
  MESSAGES: 4,
  DEFAULT: 8,
  MAX: 100,
} as const;

export const STATUS_LABELS: Record<string, string> = {
  APROBADO: 'Aprobado',
  POR_CORREGIR: 'Por corregir',
  RECHAZADO: 'Rechazado',
  ESPERANDO_VENDEDOR: 'En disputa',
  ESCALADO: 'En disputa',
  EN_MEDIACION: 'En Mediación',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ABIERTO: 'Abierto',
  EN_PROCESO: 'En Proceso',
  PENDIENTE_VENDEDOR: 'Pendiente Vendedor',
  PENDIENTE_COMPRADOR: 'Pendiente Comprador',
  SLA_VENCIDO: 'SLA Vencido',
  CERRADO: 'Cerrado',
  CANCELADO: 'Cancelado',
  VERIFICADA: 'Verificada',
  BLOQUEADA: 'Bloqueada',
} as const;

export const TRUST_COLORS: Record<string, string> = {
  ALTO: 'green',
  MEDIO: 'yellow',
  BAJO: 'red',
} as const;

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  SELLERS: '/sellers',
  SELLER_DETAIL: (id: number) => `/sellers/${id}`,
  MEDIATIONS: '/mediations',
  MEDIATION_DETAIL: (id: number) => `/mediations/${id}`,
  VALIDATIONS: '/validations',
  ALERTS: '/alerts',
  RECEIPTS: '/receipts',
  AUDITS: '/audits',
} as const;
