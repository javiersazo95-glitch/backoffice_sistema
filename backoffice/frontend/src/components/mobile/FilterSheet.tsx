import type { ReactNode } from 'react';
import BottomSheet from './BottomSheet';

interface FilterTriggerProps {
  count?: number;
  onClick: () => void;
  label?: string;
  className?: string;
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" />
    </svg>
  );
}

/** Boton "Filtros (n)" que acompaña al buscador en las listas moviles. */
export function FilterTrigger({ count = 0, onClick, label = 'Filtros', className = '' }: FilterTriggerProps) {
  return (
    <button
      type="button"
      className={`mb-filter-trigger${count > 0 ? ' has-active' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={count > 0 ? `${label} (${count} activos)` : label}
    >
      <FilterIcon />
      <span>{label}</span>
      {count > 0 && <span className="mb-filter-count">{count}</span>}
    </button>
  );
}

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  activeCount?: number;
  onClear?: () => void;
  /** Controles existentes de la pagina (siguen conectados a su estado). */
  children: ReactNode;
  applyLabel?: string;
  clearLabel?: string;
}

/**
 * Hoja de filtros en modo "live": los controles que recibe como children siguen actualizando el
 * estado de la pagina; "Listo" solo cierra la hoja y "Limpiar" delega en onClear.
 */
export default function FilterSheet({ open, onClose, title = 'Filtros', activeCount = 0, onClear, children, applyLabel = 'Listo', clearLabel = 'Limpiar' }: FilterSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={activeCount > 0 ? `${activeCount} filtro${activeCount === 1 ? '' : 's'} activo${activeCount === 1 ? '' : 's'}` : undefined}
      height="auto"
      id="mb-filters"
      footer={(
        <>
          {onClear && (
            <button type="button" className="mb-action" onClick={onClear} disabled={activeCount === 0}>{clearLabel}</button>
          )}
          <button type="button" className="mb-action mb-action--primary" onClick={onClose}>{applyLabel}</button>
        </>
      )}
    >
      <div className="mb-filter-fields">{children}</div>
    </BottomSheet>
  );
}
