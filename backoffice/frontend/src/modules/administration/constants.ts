export const TODAY = new Date().toISOString().slice(0, 10);

export const COMMISSION_RATE = 0.05;
export const MIN_COMMISSION = 690;
export const MAX_COMMISSION = 9990;
export const GATEWAY_RATE = 0.0289;
export const GATEWAY_IVA = 0.19;
export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
export const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const EXPENSE_CATEGORIES = ['Tecnología', 'Marketing', 'Legal / Contabilidad', 'Operación', 'Otros'];
export const ORDER_STATUS_OPTIONS = ['Pendiente', 'Preparando', 'Enviado', 'Recibido', 'Finalizado', 'En mediación', 'Esperando al vendedor'] as const;
export const SETTLEMENT_STATUS_OPTIONS = ['Completada', 'Enviado', 'En disputa', 'Cancelado'] as const;
export const PARTNERS = ['Javier', 'Elías'] as const;
export const WITHDRAWAL_REASON_OPTIONS = ['Retiro mensual socio', 'Retiro de saldo acumulado', 'Retiro parcial socio', 'Ajuste de retiro socio'] as const;
