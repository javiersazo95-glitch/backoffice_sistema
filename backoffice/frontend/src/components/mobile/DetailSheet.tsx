import type { ReactNode } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import BottomSheet from './BottomSheet';

export interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Acciones fijas al pie (botones a ancho completo). */
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  /** Envuelve contenido heredado de escritorio (paneles laterales) y neutraliza su layout. */
  embedded?: boolean;
  flush?: boolean;
  zIndex?: number;
}

/**
 * Pantalla de detalle a altura completa con boton "Volver". Reemplaza en movil a los paneles
 * laterales maestro/detalle de escritorio.
 */
export default function DetailSheet({ open, onClose, title, subtitle, actions, children, id, embedded, flush, zIndex }: DetailSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      height="full"
      id={id}
      title={title}
      subtitle={subtitle}
      hideClose
      flush={flush}
      zIndex={zIndex}
      className={embedded ? 'mb-embedded' : undefined}
      leading={(
        <button type="button" className="mb-sheet-back" onClick={onClose} aria-label="Volver">
          <UiIcon name="arrowLeft" />
        </button>
      )}
      footer={actions ? <div className="mb-sheet-actions">{actions}</div> : undefined}
    >
      {children}
    </BottomSheet>
  );
}
