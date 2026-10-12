import { useQuery } from '@tanstack/react-query';
import UiIcon from '@/components/shared/UiIcon';
import * as administrationApi from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import type { Order, OrderHistoryEvent, StatusHistoryItem } from './types';
import { formatDateTime, formatMoney } from './utils';

/** Color del punto y de la etiqueta segun que cambio. */
const TIPO: Record<OrderHistoryEvent['tipo'], { label: string; color: string; bg: string }> = {
  PEDIDO: { label: 'Pedido', color: '#1d4ed8', bg: '#eff6ff' },
  TIENDA: { label: 'Estado', color: '#1d4ed8', bg: '#eff6ff' },
  HITO: { label: 'Hito', color: '#0f766e', bg: '#f0fdfa' },
  PAGO: { label: 'Pago', color: '#047857', bg: '#ecfdf5' },
  REEMBOLSO: { label: 'Reembolso', color: '#b45309', bg: '#fffbeb' },
  MEDIACION: { label: 'Mediación', color: '#7c3aed', bg: '#f5f3ff' },
};

/**
 * 12-oct: el historial real de un pedido, del backend (rt_pedido_historial y lo que se deduce de
 * las fechas de los pedidos anteriores): cada estado de la tienda, hitos (boleta, entrega
 * declarada, reclamo), pagos, cada paso de los reembolsos con Flow y las mediaciones o
 * suspensiones, con su fecha y quien lo hizo. Antes era una sola linea con el estado actual.
 *
 * Una fila importada por CSV no tiene `pedidoId`: ahi se muestra el historial local de siempre.
 */
export default function OrderHistoryTimeline({ order, localHistory }: { order: Order | undefined; localHistory: StatusHistoryItem[] }) {
  const pedidoId = order?.pedidoId;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order-history', pedidoId, order?.proveedorId ?? null],
    queryFn: () => administrationApi.getOrderHistory(pedidoId as number, order?.proveedorId),
    enabled: pedidoId != null,
  });

  if (pedidoId == null) {
    return <LocalHistory history={localHistory} />;
  }
  if (isLoading) {
    return <div className="empty-state compact-empty">Cargando historial…</div>;
  }
  if (isError) {
    return (
      <div className="empty-state compact-empty" style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
        <span>No se pudo cargar el historial: {mensajeDeError(error)}</span>
        <button className="secondary-button" type="button" onClick={() => void refetch()}>Reintentar</button>
      </div>
    );
  }
  const eventos = data ?? [];
  if (eventos.length === 0) {
    return <div className="empty-state compact-empty">Sin eventos registrados para este pedido.</div>;
  }
  const hayReconstruidos = eventos.some((evento) => evento.reconstruido);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {order?.montoReembolsado ? (
        <p style={{ margin: 0, padding: '8px 12px', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: 12.5 }}>
          Esta venta tuvo un reembolso por mediación de <strong>{formatMoney(order.montoReembolsado)}</strong>; el total ya lo descuenta.
        </p>
      ) : null}
      <div style={{ maxHeight: 440, overflowY: 'auto', paddingRight: 8 }}>
        <ol style={{ position: 'relative', listStyle: 'none', margin: 0, padding: '0 0 0 24px', borderLeft: '2px solid #e2e8f0', marginLeft: 12 }}>
          {eventos.map((evento, index) => {
            const tono = TIPO[evento.tipo] ?? TIPO.TIENDA;
            return (
              <li key={`${evento.fecha}-${index}`} style={{ position: 'relative', marginBottom: index === eventos.length - 1 ? 0 : 16 }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute', left: -31, top: 6, width: 12, height: 12, borderRadius: '50%',
                    background: tono.color, border: '3px solid #fff', boxShadow: `0 0 0 2px ${tono.color}`,
                  }}
                />
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '1px 8px', borderRadius: 999, background: tono.bg, color: tono.color, fontSize: 11, fontWeight: 700 }}>{tono.label}</span>
                      <strong style={{ fontSize: 13.5, color: '#0f172a' }}>{evento.titulo}</strong>
                    </span>
                    <time style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>{formatDateTime(evento.fecha)}</time>
                  </div>
                  {evento.detalle ? <span style={{ fontSize: 12.5, color: '#475569' }}>{evento.detalle}</span> : null}
                  <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11.5, color: '#64748b' }}>
                    <span><strong>Responsable:</strong> {evento.actor}{evento.actorDetalle ? ` (${evento.actorDetalle})` : ''}</span>
                    {evento.monto != null ? <span><strong>Monto:</strong> {formatMoney(evento.monto)}</span> : null}
                    {evento.reconstruido ? <span title="Deducido de las fechas guardadas en el pedido">· reconstruido</span> : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {hayReconstruidos ? (
        <small style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#94a3b8' }}>
          <UiIcon name="info" style={{ width: 13, height: 13 }} />
          Los pasos "reconstruidos" se deducen de las fechas que ya guardaba el pedido, antes de que existiera el registro de historial.
        </small>
      ) : null}
    </div>
  );
}

function LocalHistory({ history }: { history: StatusHistoryItem[] }) {
  if (history.length === 0) {
    return <div className="empty-state compact-empty">Sin cambios de estado registrados para este pedido.</div>;
  }
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
      {history.map((item, index) => (
        <li key={index} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'grid', gap: 4 }}>
          <strong style={{ fontSize: 13 }}>{item.from ? `${item.from} → ${item.to}` : item.to}</strong>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>{formatDateTime(item.changedAt)} · {item.actor} · {item.source}</span>
          {item.note ? <span style={{ fontSize: 12, color: '#475569' }}>{item.note}</span> : null}
        </li>
      ))}
    </ol>
  );
}
