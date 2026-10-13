import type { ReactNode } from 'react';
import UiIcon from '@/components/shared/UiIcon';

/**
 * Modal de Pago a proveedores (13-oct). Antes cada popup de la pagina repetia el backdrop y el
 * panel con estilos inline; los popups nuevos de la transferencia 1:1 comparten este.
 */
export default function PpModal({
  title,
  subtitle,
  badge,
  children,
  onClose,
  width = 560,
  zIndex = 1000,
  closeDisabled = false,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  width?: number;
  zIndex?: number;
  closeDisabled?: boolean;
  className?: string;
}) {
  const close = () => { if (!closeDisabled) onClose(); };
  return (
    <div className="modal-backdrop pp-modal-backdrop" style={{ zIndex }} onClick={close} role="presentation">
      <div
        className={`modal-content pp-modal pp-modal-panel ${className}`.trim()}
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pp-modal-head">
          <div className="pp-modal-title">
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {badge && <div className="pp-modal-badge">{badge}</div>}
          <button type="button" className="icon-button" onClick={close} aria-label="Cerrar" disabled={closeDisabled}>
            <UiIcon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
