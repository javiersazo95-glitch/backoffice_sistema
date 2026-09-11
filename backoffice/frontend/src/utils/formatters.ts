export function formatDate(date: string): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  if (!date) return '';
  return new Date(date).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
  if (item.title) {
    const fromTitle = item.title.replace(/^Comprador vs /i, '').trim();
    if (fromTitle) return fromTitle;
  }
  return 'Comprador';
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

