/**
 * Pruebas de lanzamiento, 25-sep: un Pago de reembolso tal como lo expone el backend en el
 * detalle de la mediación (`refundPayment`) y en Alertas, para reintentarlo o marcarlo devuelto.
 */
export interface RefundPayment {
  paymentId: number;
  orderId?: number | null;
  /** PED-0000019 */
  orderCode?: string | null;
  origin: 'CANCELACION_COMPRADOR' | 'CANCELACION_VENDEDOR' | 'MEDIACION' | 'PAGO_TARDIO_SIN_STOCK' | 'PAGO_DUPLICADO' | 'OTRO';
  /** Monto pendiente: es lo que se vuelve a pedir a Flow al reintentar. */
  amount: number;
  /** Estado crudo del Pago: REEMBOLSO_ERROR, REEMBOLSO_RECHAZADO, REEMBOLSO_SOLICITADO, REEMBOLSADO... */
  status: string;
  errorDetail?: string | null;
  manual: boolean;
  manualNote?: string | null;
  manualBy?: string | null;
  manualAt?: string | null;
  /** Admite "Reintentar reembolso" y "Marcar como devuelto manualmente". */
  actionable: boolean;
}
