import { useEffect, useId, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import UiIcon from '@/components/shared/UiIcon';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { useBackToClose } from '@/hooks/useBackToClose';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** 'auto' = hoja parcial anclada abajo (max 88dvh); 'full' = pantalla completa. */
  height?: 'auto' | 'full';
  /** Elemento a la izquierda del titulo (p. ej. boton "Volver"). */
  leading?: ReactNode;
  /** Oculta la X de cierre (util cuando `leading` ya ofrece "Volver"). */
  hideClose?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
  id?: string;
  dismissOnBackdrop?: boolean;
  zIndex?: number;
  className?: string;
  /** Quita el padding interno del cuerpo (listas que llegan al borde). */
  flush?: boolean;
}

/**
 * Hoja inferior movil: portal a body, bloqueo de scroll, cierre con Escape, con el boton
 * "atras" del telefono y tocando el fondo. Header y footer fijos, cuerpo con scroll propio.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  height = 'auto',
  leading,
  hideClose = false,
  footer,
  children,
  ariaLabel,
  id,
  dismissOnBackdrop = true,
  zIndex,
  className = '',
  flush = false,
}: BottomSheetProps) {
  const autoId = useId();
  const sheetId = id ?? autoId;
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLockBodyScroll(open);
  useBackToClose(open, onClose, sheetId);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey);
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (!dismissOnBackdrop) return;
    if (event.target === event.currentTarget) onClose();
  };

  const showHead = Boolean(title || subtitle || leading || !hideClose);

  return createPortal(
    <div
      className={`mb-sheet-backdrop mb-sheet-backdrop--${height}`}
      style={zIndex ? { zIndex } : undefined}
      onClick={handleBackdrop}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        className={`mb-sheet mb-sheet--${height} ${className}`.trim()}
      >
        {height === 'auto' && <span className="mb-sheet-grabber" aria-hidden="true" />}
        {showHead && (
          <header className="mb-sheet-head">
            {leading}
            <div className="mb-sheet-titles">
              {title && <h2>{title}</h2>}
              {subtitle && <p>{subtitle}</p>}
            </div>
            {!hideClose && (
              <button type="button" className="mb-sheet-close" onClick={onClose} aria-label="Cerrar">
                <UiIcon name="close" />
              </button>
            )}
          </header>
        )}
        <div className={`mb-sheet-body${flush ? ' mb-sheet-body--flush' : ''}`}>{children}</div>
        {footer && <footer className="mb-sheet-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
