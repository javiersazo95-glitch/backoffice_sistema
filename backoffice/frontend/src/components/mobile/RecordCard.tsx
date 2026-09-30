import type { KeyboardEvent, ReactNode } from 'react';

export interface RecordMeta {
  label: string;
  value: ReactNode;
  /** Ocupa las dos columnas (textos largos). */
  wide?: boolean;
}

export interface RecordCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Badge(s) de estado, arriba a la derecha. */
  badge?: ReactNode;
  /** Avatar o icono de 40px a la izquierda del titulo. */
  leading?: ReactNode;
  meta?: RecordMeta[];
  /** Fila de acciones al pie; recibe botones `.mb-action`. */
  actions?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  tone?: 'default' | 'warning' | 'danger' | 'success' | 'muted';
  footer?: ReactNode;
  className?: string;
  ariaLabel?: string;
  /** 'below' pone las insignias en fila bajo el subtitulo (titulos largos). */
  badgePlacement?: 'aside' | 'below';
  /** Limita el titulo a 3 lineas. */
  clampTitle?: boolean;
}

function Chevron() {
  return (
    <svg className="mb-record-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** Correos y textos largos no caben en media columna: pasan a ancho completo. */
function isWide(item: RecordMeta): boolean {
  if (item.wide) return true;
  if (typeof item.value !== 'string') return false;
  return item.value.includes('@') || item.value.length > 26;
}

/**
 * Tarjeta de registro: la unidad basica de las listas moviles que reemplazan a las tablas.
 * Anatomia: [leading] titulo ····· badge / subtitulo / meta (2 col) / footer / acciones.
 */
export default function RecordCard({
  title,
  subtitle,
  badge,
  leading,
  meta,
  actions,
  onPress,
  selected = false,
  tone = 'default',
  footer,
  className = '',
  ariaLabel,
  badgePlacement = 'aside',
  clampTitle = false,
}: RecordCardProps) {
  const interactive = typeof onPress === 'function';

  const handleKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!interactive) return;
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPress?.();
    }
  };

  return (
    <article
      className={`mb-record mb-record--${tone}${selected ? ' selected' : ''}${interactive ? ' interactive' : ''} ${className}`.trim()}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      aria-pressed={interactive && selected ? true : undefined}
      onClick={interactive ? onPress : undefined}
      onKeyDown={handleKey}
    >
      <div className="mb-record-head">
        {leading && <div className="mb-record-leading">{leading}</div>}
        <div className="mb-record-titles">
          <h3 className={clampTitle ? 'mb-clamp' : undefined}>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
          {badge && badgePlacement === 'below' && <div className="mb-record-badges-inline">{badge}</div>}
        </div>
        {badge && badgePlacement === 'aside' && <div className="mb-record-badge">{badge}</div>}
        {interactive && <Chevron />}
      </div>

      {meta && meta.length > 0 && (
        <dl className="mb-record-meta">
          {meta.map((item, index) => (
            <div key={`${item.label}-${index}`} className={`mb-record-meta-item${isWide(item) ? ' wide' : ''}`}>
              <dt>{item.label}</dt>
              <dd>{item.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}

      {footer && <div className="mb-record-foot">{footer}</div>}

      {actions && (
        <div className="mb-record-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          {actions}
        </div>
      )}
    </article>
  );
}
