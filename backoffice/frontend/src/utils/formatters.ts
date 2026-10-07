/**
 * O77 (pruebas de lanzamiento, 27-sep): las fechas del backoffice se muestran en hora de Chile,
 * igual que el Market. Un instante con zona ("2026-09-27T12:35:00Z", como serializa Jackson un
 * OffsetDateTime) se convierte a America/Santiago sin depender del huso del navegador; uno sin zona
 * ("2026-09-27T09:35") ya viene en hora de Chile y se deja tal cual.
 */
export const CHILE_TIME_ZONE = 'America/Santiago';

const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const chileParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHILE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function hasTimeZone(value: string): boolean {
  return value.includes('T') && OFFSET_SUFFIX.test(value);
}

/**
 * "YYYY-MM-DDTHH:mm" en hora de Chile. Sirve a las pantallas que cortan el texto ISO (fecha con
 * `slice(0, 10)`, hora con `split('T')`): sobre un valor en UTC mostraban la hora UTC y, entre las
 * 21:00 y las 24:00, el dia siguiente. Lo que no trae zona (o no se puede leer) vuelve igual.
 */
export function toChileIso(value: string): string {
  if (!value || !hasTimeZone(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const parts = Object.fromEntries(chileParts.formatToParts(parsed).map((part) => [part.type, part.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

function parseForDisplay(value: string): Date {
  // Una fecha sin hora es un dia local: `new Date("2026-09-27")` es medianoche UTC y en Chile se
  // veia el 26.
  if (DATE_ONLY.test(value)) {
    return new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
  }
  return new Date(value);
}

/**
 * "YYYY-MM" del mes en curso en hora de Chile. `toISOString().slice(0, 7)` daba el mes en UTC:
 * el ultimo dia de cada mes, entre las 20 y las 24 h de Chile, los filtros de "mes actual"
 * consultaban el mes siguiente y salian vacios.
 */
export function mesActualChile(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CHILE_TIME_ZONE, year: 'numeric', month: '2-digit' }).format(new Date());
}

export function formatDate(date: string): string {
  if (!date) return '';
  const parsed = parseForDisplay(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(hasTimeZone(date) ? { timeZone: CHILE_TIME_ZONE } : {}),
  });
}

export function formatDateTime(date: string): string {
  if (!date) return '';
  const parsed = parseForDisplay(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(hasTimeZone(date) ? { timeZone: CHILE_TIME_ZONE } : {}),
  });
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return amount as string;
  return num.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  });
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function trustLevelToSpanish(level: string): string {
  const map: Record<string, string> = {
    ALTO: 'Alto',
    MEDIO: 'Medio',
    BAJO: 'Bajo',
  };
  return map[level] ?? level;
}

export function statusToSpanish(status: string): string {
  const map: Record<string, string> = {
    APROBADO: 'Aprobado',
    POR_CORREGIR: 'Por corregir',
    RECHAZADO: 'Rechazado',
  };
  return map[status] ?? status;
}

export function sellerStatusDisplay(status: string): string {
  const map: Record<string, string> = {
    APROBADO: 'Aprobado',
    POR_CORREGIR: 'Por corregir',
    RECHAZADO: 'Rechazado',
  };
  return map[status] ?? status;
}

export function mediationStatusDisplay(status: string, accountBlocked: boolean): string {
  if (accountBlocked) return 'Cuenta Bloqueada';
  const map: Record<string, string> = {
    EN_MEDIACION: 'En Mediación',
    RESUELTA: 'Resuelta',
    CERRADA: 'Cerrada',
  };
  return map[status] ?? status;
}

export function mediationStatusOptions(): string[] {
  return ['Todos', 'En mediación', 'Cuenta bloqueada'];
}

export function mediationStatusHelp(status: string): string {
  const help: Record<string, string> = {
    'En mediación': 'Caso con un mediador de RepuesTop en curso. El icono de mediación va en morado.',
    'Cuenta bloqueada': 'Cuenta bloqueada desde una mediación. Solo corresponde reactivar si existe respaldo acreditador.',
  };
  return help[status] || 'Todos los casos visibles en el período seleccionado.';
}

export function mediationEscalationReason(item: { escalationReason?: string; status: string; reason: string }): string {
  if (item.escalationReason) return item.escalationReason;
  return mediationStatusHelp(item.status);
}

export function mediationCaseSummary(item: { id: string | number; orderId: string; title: string; reason: string; amount: string | number; status: string }, sellerName: string): string {
  const buyer = item.title.replace('Comprador vs ', '') || 'Comprador';
  return `Caso ${item.id} asociado al pedido ${item.orderId}. Comprador: ${buyer}. Vendedor: ${sellerName}. Motivo: ${item.reason}. Monto involucrado: ${item.amount}. Estado actual: ${item.status}.`;
}

export function resolveBuyerName(item?: { buyer?: string | null; title?: string | null } | null): string {
  if (!item) return 'Comprador';
  if (item.buyer && item.buyer.trim()) return item.buyer.trim();
  // H62: solo los casos "Comprador vs <nombre>" llevan al comprador en el titulo. En una
  // suspension directa el titulo es "Suspensión directa de cuenta" y se mostraba como comprador.
  if (item.title && /^Comprador vs /i.test(item.title)) {
    const fromTitle = item.title.replace(/^Comprador vs /i, '').trim();
    if (fromTitle) return fromTitle;
  }
  return item.title ? 'Sin comprador asociado' : 'Comprador';
}

export interface BlockedTargetInfo {
  isBuyer: boolean;
  targetRole: 'COMPRADOR' | 'VENDEDOR';
  roleLabel: string;
  targetName: string;
  fullTargetLabel: string;
}

export function getBlockedTargetInfo(item?: {
  suspensionTarget?: 'COMPRADOR' | 'VENDEDOR' | string | null;
  suspensionMotivo?: string | null;
  suspensionDetalle?: string | null;
  buyer?: string | null;
  title?: string | null;
  sellerName?: string | null;
  reason?: string | null;
  escalationReason?: string | null;
  targetRole?: string | null;
  [key: string]: any;
} | null): BlockedTargetInfo {
  if (!item) {
    return {
      isBuyer: false,
      targetRole: 'VENDEDOR',
      roleLabel: 'Tienda',
      targetName: 'Tienda',
      fullTargetLabel: 'Tienda',
    };
  }

  const buyerName = resolveBuyerName(item);
  const sellerName = item.sellerName?.trim() || 'Tienda';

  const rawTarget = String(item.suspensionTarget || item.targetRole || '').toUpperCase();
  const isBuyer =
    rawTarget === 'COMPRADOR' ||
    (!rawTarget && (
      Boolean(item.suspensionMotivo && /comprador/i.test(item.suspensionMotivo)) ||
      Boolean(item.suspensionDetalle && /comprador/i.test(item.suspensionDetalle))
    ));

  if (isBuyer) {
    return {
      isBuyer: true,
      targetRole: 'COMPRADOR',
      roleLabel: 'Comprador',
      targetName: buyerName,
      fullTargetLabel: `Comprador: ${buyerName}`,
    };
  }

  return {
    isBuyer: false,
    targetRole: 'VENDEDOR',
    roleLabel: 'Tienda',
    targetName: sellerName,
    fullTargetLabel: `Tienda: ${sellerName}`,
  };
}

