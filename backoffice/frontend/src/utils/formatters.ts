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
    ESPERANDO_VENDEDOR: 'En disputa',
    ESCALADO: 'En disputa',
    EN_MEDIACION: 'En Mediación',
    RESUELTA: 'Resuelta',
    CERRADA: 'Cerrada',
  };
  return map[status] ?? status;
}

export function mediationStatusOptions(): string[] {
  return ['Todos', 'En mediación', 'Cuenta bloqueada', 'En disputa'];
}

export function mediationStatusHelp(status: string): string {
  const help: Record<string, string> = {
    'En mediación': 'Caso formal ya inicializado. El icono de mediación va en morado.',
    'Cuenta bloqueada': 'Cuenta bloqueada desde una mediación inicializada. Solo corresponde reactivar si existe respaldo acreditador.',
    'En disputa': 'Caso pendiente de respuesta del vendedor. Desde aquí el equipo puede iniciar mediación cuando corresponda.',
  };
  return help[status] || 'Todos los casos visibles en el período seleccionado.';
}

export function mediationEscalationReason(item: { escalationReason?: string; status: string; reason: string }): string {
  if (item.escalationReason) return item.escalationReason;
  if ((item.status === 'ESCALADO' || item.status === 'ESPERANDO_VENDEDOR') && item.reason.toLowerCase().includes('boleta')) {
    return 'El vendedor aún no emite la boleta y el caso espera gestión.';
  }
  if (item.status === 'ESCALADO' || item.status === 'ESPERANDO_VENDEDOR') {
    return 'El caso espera respuesta o gestión del vendedor.';
  }
  return mediationStatusHelp(item.status);
}

export function mediationCaseSummary(item: { id: string | number; orderId: string; title: string; reason: string; amount: string | number; status: string }, sellerName: string): string {
  const buyer = item.title.replace('Comprador vs ', '') || 'Comprador';
  return `Caso ${item.id} asociado al pedido ${item.orderId}. Comprador: ${buyer}. Vendedor: ${sellerName}. Motivo: ${item.reason}. Monto involucrado: ${item.amount}. Estado actual: ${item.status}.`;
}
