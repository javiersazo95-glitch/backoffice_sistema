const LABELS: Record<string, string> = {
  SIN_SOLICITUD: 'Sin solicitud',
  PENDIENTE: 'En revisión',
  APROBADO: 'Acreditado',
  POR_CORREGIR: 'Por corregir',
  RECHAZADO: 'Rechazado',
};

const TONES: Record<string, string> = {
  SIN_SOLICITUD: 'blue',
  PENDIENTE: 'amber',
  APROBADO: 'green',
  POR_CORREGIR: 'orange',
  RECHAZADO: 'red',
};

export const WORKSHOP_STATUS_OPTIONS = Object.entries(LABELS).map(([value, label]) => ({ value, label }));

export function getWorkshopStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function getWorkshopStatusTone(status: string): string {
  return TONES[status] ?? '';
}

const NEED_LABELS: Record<string, string> = {
  ACTIVA: 'Activa',
  FINALIZADA: 'Finalizada',
  EXPIRADA: 'Expirada',
  CANCELADA: 'Cancelada',
};

const NEED_TONES: Record<string, string> = {
  ACTIVA: 'blue',
  FINALIZADA: 'green',
  EXPIRADA: 'amber',
  CANCELADA: 'red',
};

export function getPurchaseNeedLabel(status: string): string {
  return NEED_LABELS[status] ?? status;
}

export function getPurchaseNeedTone(status: string): string {
  return NEED_TONES[status] ?? '';
}
