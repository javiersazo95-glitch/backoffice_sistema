import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as refundsApi from '@/api/refunds';
import type { RefundPayment } from '@/types/refund';
import { showToast } from '@/components/layout/Toast';
import UiIcon from '@/components/shared/UiIcon';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

/**
 * Pruebas de lanzamiento, 25-sep: acciones de soporte sobre un reembolso en REEMBOLSO_ERROR o
 * REEMBOLSO_RECHAZADO. "Reintentar reembolso" lo vuelve a pedir a Flow por el mismo monto
 * pendiente; "Marcar como devuelto manualmente" registra una devolución hecha fuera del sistema
 * (nota obligatoria). Ambas piden confirmación, con el mismo molde que el diálogo O64
 * ("¿Resolver a favor de X?") del detalle de la mediación.
 *
 * Se usa en el detalle de la mediación y en el panel lateral de Alertas.
 */
interface RefundSupportActionsProps {
  refund: RefundPayment;
  /** Se llama con el Pago como quedó tras la acción (éxito o reintento fallido). */
  onDone?: (refund: RefundPayment) => void;
}

const MAX_NOTE = 500;

function originLabel(origin: RefundPayment['origin']): string {
  switch (origin) {
    case 'CANCELACION_COMPRADOR':
      return 'cancelación del comprador';
    case 'CANCELACION_VENDEDOR':
      return 'cancelación del vendedor';
    case 'MEDIACION':
      return 'resolución de mediación';
    case 'PAGO_TARDIO_SIN_STOCK':
      return 'pago tardío sin stock';
    case 'PAGO_DUPLICADO':
      return 'pago duplicado';
    default:
      return 'reembolso';
  }
}

export default function RefundSupportActions({ refund, onDone }: RefundSupportActionsProps) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<'retry' | 'manual' | null>(null);
  const [note, setNote] = useState('');

  const amountText = formatCurrency(refund.amount ?? 0);
  // O72: el backend manda el numero publico del pedido ("4827 1936 00"); nunca se arma "PED-" con la PK.
  const orderText = refund.orderCode ?? 'sin número';

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mediation'] });
    queryClient.invalidateQueries({ queryKey: ['mediations'] });
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
    queryClient.invalidateQueries({ queryKey: ['audits'] });
  };

  const errorMessage = (error: any, fallback: string) =>
    error?.response?.data?.message || error?.response?.data?.detail || fallback;

  const retryMutation = useMutation({
    mutationFn: () => refundsApi.retryRefund(refund.paymentId),
    onSuccess: (result) => {
      setDialog(null);
      refresh();
      if (result.status === 'REEMBOLSO_ERROR') {
        showToast(`Flow volvió a rechazar el reembolso: ${result.errorDetail || 'sin detalle'}`);
      } else {
        showToast('Reembolso solicitado nuevamente a Flow. El comprador recibirá el correo para aceptarlo.');
      }
      onDone?.(result);
    },
    onError: (error: any) => {
      setDialog(null);
      refresh();
      showToast(errorMessage(error, 'No se pudo reintentar el reembolso'));
    },
  });

  const manualMutation = useMutation({
    mutationFn: (value: string) => refundsApi.markRefundManual(refund.paymentId, value),
    onSuccess: (result) => {
      setDialog(null);
      setNote('');
      refresh();
      showToast('Devolución registrada como realizada manualmente');
      onDone?.(result);
    },
    onError: (error: any) => {
      refresh();
      showToast(errorMessage(error, 'No se pudo registrar la devolución manual'));
    },
  });

  const busy = retryMutation.isPending || manualMutation.isPending;
  const trimmedNote = note.trim();
  const noteValid = trimmedNote.length > 0 && trimmedNote.length <= MAX_NOTE;

  if (refund.manual) {
    return (
      <div
        style={{
          padding: '8px 10px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 8,
          color: '#166534',
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        <strong>Devuelto manualmente por soporte</strong>
        {refund.manualBy ? ` · ${refund.manualBy}` : ''}
        {refund.manualAt ? ` · ${formatDateTime(refund.manualAt)}` : ''}
        {refund.manualNote ? <div style={{ marginTop: 2 }}>Nota: {refund.manualNote}</div> : null}
      </div>
    );
  }

  if (!refund.actionable) {
    return null;
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 8 }}>
        {refund.errorDetail ? (
          <div
            style={{
              padding: '8px 10px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#991b1b',
              fontSize: 12,
              lineHeight: 1.45,
              wordBreak: 'break-word',
            }}
          >
            <strong>Último error de Flow:</strong> {refund.errorDetail}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            className="primary-button"
            type="button"
            style={{ background: '#d97706', borderColor: '#b45309' }}
            onClick={() => setDialog('retry')}
            disabled={busy}
          >
            <UiIcon name="refresh" /> Reintentar reembolso
          </button>
          <button className="secondary-button" type="button" onClick={() => setDialog('manual')} disabled={busy}>
            <UiIcon name="check" /> Marcar como devuelto manualmente
          </button>
        </div>
      </div>

      {/* Portal: las acciones viven dentro del chat del comprador o del panel lateral de Alertas;
          el dialogo se monta en <body> para cubrir toda la pantalla. */}
      {dialog ? createPortal(
        <div className="modal-backdrop" onClick={() => !busy && setDialog(null)}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-action-title"
            style={{ width: 'min(520px, 95%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-block">
                <h2 id="refund-action-title" style={{ color: '#b45309' }}>
                  {dialog === 'retry' ? '¿Reintentar el reembolso?' : '¿Marcar como devuelto manualmente?'}
                </h2>
                <p>
                  Pedido {orderText} &bull; {amountText} &bull; {originLabel(refund.origin)}
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setDialog(null)} aria-label="Cerrar" disabled={busy}>
                <UiIcon name="close" />
              </button>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 12 }}>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  color: '#92400e',
                  fontSize: 12.5,
                  lineHeight: 1.45,
                }}
              >
                {dialog === 'retry'
                  ? `Se solicitará a Flow un reembolso de ${amountText} para el pedido ${orderText}. Flow le enviará al comprador el correo para aceptarlo. Esta acción no se puede deshacer.`
                  : `Se registrará que los ${amountText} del pedido ${orderText} ya fueron devueltos al comprador fuera del sistema (transferencia, panel de Flow). El comprador verá la devolución como realizada y no se pedirá nada a Flow. Esta acción no se puede deshacer.`}
              </div>

              {dialog === 'manual' ? (
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>Nota de la devolución *</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    N° de operación, banco o medio usado. Queda en la auditoría con tu usuario y la fecha.
                  </span>
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={MAX_NOTE}
                    placeholder="Ej: Transferencia BCI N° 123456 del 25-09"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={busy}
                  />
                  {!noteValid && note.length > 0 ? (
                    <small style={{ color: '#dc2626' }}>La nota es obligatoria.</small>
                  ) : null}
                </label>
              ) : null}
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="secondary-button" type="button" onClick={() => setDialog(null)} disabled={busy}>
                Cancelar
              </button>
              {dialog === 'retry' ? (
                <button
                  className="primary-button"
                  type="button"
                  style={{ background: '#d97706', borderColor: '#b45309' }}
                  onClick={() => retryMutation.mutate()}
                  disabled={busy}
                >
                  {retryMutation.isPending ? 'Solicitando…' : 'Sí, reintentar reembolso'}
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  style={{ background: '#d97706', borderColor: '#b45309' }}
                  onClick={() => manualMutation.mutate(trimmedNote)}
                  disabled={busy || !noteValid}
                >
                  {manualMutation.isPending ? 'Registrando…' : 'Sí, marcar como devuelto'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
