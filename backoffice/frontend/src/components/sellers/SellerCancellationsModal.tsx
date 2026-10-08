import { useQuery } from '@tanstack/react-query';
import { getSellerCancellations } from '@/api/sellers';
import UiIcon from '@/components/shared/UiIcon';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { SellerCancellationRate } from '@/types/seller';
import { cancellationLevel } from './cancellationReasons';

interface SellerCancellationsModalProps {
  sellerId: number;
  storeName: string;
  rate: SellerCancellationRate;
  onClose: () => void;
  /** Abre la ficha completa del vendedor, si la pantalla lo permite. */
  onViewProfile?: () => void;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatCLP(value: number) {
  return `$${new Intl.NumberFormat('es-CL').format(Math.round(value ?? 0))}`;
}

/**
 * Todo lo que canceló una tienda en la ventana de la tasa, con el motivo que eligió y la fecha.
 * Existe para que el moderador entienda qué pasa con un vendedor sin tener que abrir su perfil.
 */
export default function SellerCancellationsModal({ sellerId, storeName, rate, onClose, onViewProfile }: SellerCancellationsModalProps) {
  const isMobile = useIsMobile();
  useLockBodyScroll(isMobile);
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['seller-cancellations', sellerId, rate.dias],
    queryFn: () => getSellerCancellations(sellerId, rate.dias),
  });

  const porMotivo = Object.entries(
    data.reduce<Record<string, number>>((acc, fila) => {
      acc[fila.motivoEtiqueta] = (acc[fila.motivoEtiqueta] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const level = cancellationLevel(rate);

  return (
    <div className="case-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="seller-documents-modal seller-cancellations-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-cancellations-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="seller-documents-header">
          <div className="seller-documents-heading">
            <span className={`seller-documents-icon seller-cancellations-icon is-${level}`}>
              <UiIcon name="alert" />
            </span>
            <div className="seller-documents-title">
              <h2 id="seller-cancellations-title">Cancelaciones de la tienda</h2>
              <p>{storeName} · últimos {rate.dias ?? 90} días</p>
            </div>
          </div>
          <button className="seller-documents-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
            <span>Cerrar</span>
          </button>
        </header>

        <section className="seller-cancellations-body">
          <div className={`seller-cancellations-summary is-${level}`}>
            <div>
              <strong>{rate.tasa.toFixed(1)}%</strong>
              <span>{rate.canceladas} de {rate.ventas} ventas canceladas por la tienda</span>
            </div>
            <p>
              {level === 'high'
                ? `Supera el umbral de ${formatUmbral(rate)}. Revisa los motivos: si se repiten o no se justifican, contacta a la tienda.`
                : level === 'warn'
                  ? `Bajo el umbral de ${formatUmbral(rate)}, pero conviene seguirlo.`
                  : 'La tienda no canceló ventas en este periodo.'}
            </p>
          </div>

          {porMotivo.length > 0 && (
            <div className="seller-cancellations-reasons" aria-label="Cancelaciones por motivo">
              {porMotivo.map(([motivo, cantidad]) => (
                <span key={motivo}><strong>{cantidad}</strong> {motivo}</span>
              ))}
            </div>
          )}

          {isError && <QueryErrorNotice error={error} what="las cancelaciones" onRetry={refetch} />}

          {isLoading ? (
            <p className="row-sub">Cargando cancelaciones...</p>
          ) : data.length === 0 ? (
            <p className="row-sub seller-cancellations-empty">No hay ventas canceladas por la tienda en este periodo.</p>
          ) : (
            <div className="table-wrap">
              <table className="wide-table seller-profile-table seller-cancellations-table">
                <thead>
                  <tr>
                    <th>Cancelada el</th>
                    <th>Pedido</th>
                    <th>Producto</th>
                    <th>Monto</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((fila) => (
                    <tr key={fila.pedidoId}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(fila.canceladoEn ?? fila.fechaPedido)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><strong>{fila.numeroPedido || '—'}</strong></td>
                      <td>{fila.productos || 'Producto no informado'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatCLP(fila.monto)}</td>
                      <td>
                        <span className="seller-cancellation-reason">{fila.motivoEtiqueta}</span>
                        {fila.detalle && <small className="seller-cancellation-detail">“{fila.detalle}”</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {onViewProfile && (
            <button className="profile-inline-link" type="button" onClick={onViewProfile}>
              Ver perfil completo del vendedor <UiIcon name="arrowRight" />
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

function formatUmbral(rate: SellerCancellationRate) {
  const umbral = rate.umbralPorcentaje != null ? `${String(rate.umbralPorcentaje).replace('.', ',')}%` : 'la plataforma';
  return rate.minimoVentas ? `${umbral} (con al menos ${rate.minimoVentas} ventas)` : umbral;
}
