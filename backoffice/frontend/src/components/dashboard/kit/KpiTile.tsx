import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import UiIcon from '@/components/shared/UiIcon';

export type KpiTone = 'blue' | 'amber' | 'violet' | 'red' | 'green' | 'muted';

export interface KpiTileProps {
  label: string;
  /** null mientras no hay dato (se muestra "—"). */
  value: number | string | null | undefined;
  tone: KpiTone;
  /** Detalle corto bajo el valor: "3 sin documento · 1 con fondos retenidos". */
  secondary?: string;
  /** Ruta a la pantalla donde se actua. Con `to` la tarjeta es un boton. */
  to?: string;
  iconName?: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => unknown;
  /** Resalta en rojo cuando el valor es mayor que cero. */
  urgent?: boolean;
  /** "Que hacer" con este numero: se muestra en el tooltip del icono i. */
  infoContent?: ReactNode;
}

/**
 * Tarjeta de indicador para los resumenes de area.
 *
 * Reglas: cada numero lleva a la pantalla donde se actua (`to`), explica que hacer con el (icono
 * i) y nunca muestra "0" cuando en realidad fallo la carga: en ese caso dice "No se pudo cargar"
 * y ofrece reintentar.
 */
export default function KpiTile({ label, value, tone, secondary, to, iconName = 'dashboard', loading, error, onRetry, urgent, infoContent }: KpiTileProps) {
  const navigate = useNavigate();
  const isUrgent = Boolean(urgent) && typeof value === 'number' && value > 0;
  const className = `dash-kpi tone-${tone}${isUrgent ? ' dash-kpi--urgent' : ''}${to ? ' dash-kpi--link' : ''}`;

  const body = (
    <>
      <div className="dash-kpi-head">
        <span className="dash-kpi-icon"><UiIcon name={iconName} /></span>
        <span className="dash-kpi-label">
          {label}
          {infoContent && (
            <span className="metric-info-tooltip" tabIndex={0} onClick={(event) => event.stopPropagation()}>
              <UiIcon name="info" />
              <span className="metric-info-tooltip-content">{infoContent}</span>
            </span>
          )}
        </span>
      </div>
      {loading ? (
        <span className="dash-skeleton-line dash-skeleton-line--value" aria-label="Cargando" />
      ) : error ? (
        <span className="dash-kpi-error">
          <strong>—</strong>
          <small>No se pudo cargar.</small>
          {onRetry && <button type="button" className="dash-link-button" onClick={(event) => { event.stopPropagation(); void onRetry(); }}>Reintentar</button>}
        </span>
      ) : (
        <strong className="dash-kpi-value">{value === null || value === undefined ? '—' : typeof value === 'number' ? value.toLocaleString('es-CL') : value}</strong>
      )}
      {secondary && !loading && !error && <span className="dash-kpi-secondary">{secondary}</span>}
      {to && <span className="dash-kpi-go">Abrir <UiIcon name="arrowRight" /></span>}
    </>
  );

  if (to) {
    return (
      <button type="button" className={className} onClick={() => navigate(to)} aria-label={`${label}: abrir`}>
        {body}
      </button>
    );
  }
  return <article className={className}>{body}</article>;
}
