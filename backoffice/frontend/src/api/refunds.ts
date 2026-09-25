import apiClient from './client';
import type { RefundPayment } from '@/types/refund';

/**
 * Pruebas de lanzamiento, 25-sep: vuelve a pedir a Flow el mismo monto pendiente, con orden nueva.
 * Si Flow vuelve a fallar responde 200 con `status: 'REEMBOLSO_ERROR'` y el mensaje en `errorDetail`.
 */
export async function retryRefund(paymentId: number): Promise<RefundPayment> {
  const response = await apiClient.post<RefundPayment>(`/refunds/${paymentId}/retry`);
  return response.data;
}

/** Registra que soporte devolvió la plata fuera del sistema. La nota es obligatoria. */
export async function markRefundManual(paymentId: number, note: string): Promise<RefundPayment> {
  const response = await apiClient.post<RefundPayment>(`/refunds/${paymentId}/mark-manual`, { note });
  return response.data;
}
