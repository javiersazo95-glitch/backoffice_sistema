import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import UiIcon from '@/components/shared/UiIcon';
import type { SellerCancellationRate } from '@/types/seller';
import SellerCancellationsModal from './SellerCancellationsModal';
import { cancellationLevel, type CancellationLevel } from './cancellationReasons';

const LEVEL_LABEL: Record<CancellationLevel, string> = {
  high: 'Cancela demasiado',
  warn: 'Con cancelaciones',
  none: 'Sin cancelaciones',
};

interface CancellationRateCellProps {
  sellerId: number;
  storeName: string;
  rate?: SellerCancellationRate;
  onViewProfile?: () => void;
}

/**
 * Columna "Cancelaciones" del listado: el porcentaje y un ícono "i" con color de alerta. Al pasar
 * el mouse explica qué mide el número; al presionarlo abre las cancelaciones con su motivo.
 */
export default function CancellationRateCell({ sellerId, storeName, rate, onViewProfile }: CancellationRateCellProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [tooltip, setTooltip] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);

  if (!rate) {
    return <span className="seller-cancellation-rate is-empty">Sin ventas</span>;
  }

  const level = cancellationLevel(rate);
  const dias = rate.dias ?? 90;
  const umbral = rate.umbralPorcentaje != null ? `${String(rate.umbralPorcentaje).replace('.', ',')}%` : null;

  const showTooltip = () => {
    const box = anchorRef.current?.getBoundingClientRect();
    if (!box) return;
    // Por encima del ícono y centrado; se recorta contra los bordes de la ventana.
    const left = Math.min(Math.max(box.left + box.width / 2, 150), window.innerWidth - 150);
    setTooltip({ top: box.top - 8, left });
  };

  return (
    <div className="seller-cancellation-cell">
      <span className={level === 'high' ? 'seller-cancellation-rate is-high' : 'seller-cancellation-rate'}>
        {rate.tasa.toFixed(1)}%
      </span>
      <button
        ref={anchorRef}
        type="button"
        className={`seller-cancellation-info is-${level}`}
        aria-label={`${LEVEL_LABEL[level]}: ${rate.canceladas} de ${rate.ventas} ventas canceladas. Ver cancelaciones`}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setTooltip(null)}
        onFocus={showTooltip}
        onBlur={() => setTooltip(null)}
        onClick={(event) => {
          event.stopPropagation();
          setTooltip(null);
          setOpen(true);
        }}
      >
        <UiIcon name="info" />
      </button>

      {tooltip && createPortal(
        <div className={`seller-cancellation-tooltip is-${level}`} role="tooltip" style={{ top: tooltip.top, left: tooltip.left }}>
          <strong>{LEVEL_LABEL[level]}</strong>
          <p>
            Porcentaje de ventas que la propia tienda canceló en los últimos {dias} días:{' '}
            <b>{rate.canceladas} de {rate.ventas}</b>. No cuenta lo que canceló el comprador ni los pagos vencidos.
          </p>
          {umbral && (
            <p>
              Se marca en rojo sobre {umbral}
              {rate.minimoVentas ? ` con al menos ${rate.minimoVentas} ventas` : ''}. Solo es una alerta: no suspende a nadie.
            </p>
          )}
          <em>{rate.canceladas > 0 ? 'Presiona para ver cada cancelación con su motivo.' : 'Presiona para ver el detalle.'}</em>
        </div>,
        document.body,
      )}

      {/* El modal vive dentro de la fila: sin esto, cada clic adentro tambien expandiria la fila. */}
      {open && createPortal(
        <div onClick={(event) => event.stopPropagation()}>
        <SellerCancellationsModal
          sellerId={sellerId}
          storeName={storeName}
          rate={rate}
          onClose={() => setOpen(false)}
          onViewProfile={onViewProfile ? () => { setOpen(false); onViewProfile(); } : undefined}
        />
        </div>,
        document.body,
      )}
    </div>
  );
}
