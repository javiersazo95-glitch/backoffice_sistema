import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import UiIcon from '@/components/shared/UiIcon';

export interface MiniBarItem {
  key: string;
  label: string;
  value: number;
  tone?: 'blue' | 'amber' | 'violet' | 'red' | 'green' | 'muted';
  to?: string;
}

interface MiniBarsProps {
  title?: string;
  help?: ReactNode;
  items: MiniBarItem[];
  /** Base del porcentaje; por defecto el mayor valor (barras relativas entre si). */
  total?: number;
  format?: (value: number) => string;
  loading?: boolean;
  emptyText?: string;
  /** Muestra el % junto al valor (requiere `total`). */
  showPercent?: boolean;
}

/** Barras horizontales en CSS: la distribucion "por estado", "por prioridad" o "por dia". */
export default function MiniBars({ title, help, items, total, format = (value) => value.toLocaleString('es-CL'), loading, emptyText = 'Sin datos en este periodo.', showPercent }: MiniBarsProps) {
  const navigate = useNavigate();
  const base = total ?? Math.max(0, ...items.map((item) => item.value));
  const hasData = items.some((item) => item.value > 0);

  return (
    <section className="dash-section">
      {title && (
        <div className="dash-section-head">
          <h2>{title}{help && <span className="metric-info-tooltip" tabIndex={0}><UiIcon name="info" /><span className="metric-info-tooltip-content">{help}</span></span>}</h2>
        </div>
      )}
      {loading ? (
        <div aria-busy="true"><span className="dash-skeleton-line" /><span className="dash-skeleton-line" /><span className="dash-skeleton-line dash-skeleton-line--short" /></div>
      ) : !hasData ? (
        <div className="dash-empty"><UiIcon name="list" /> {emptyText}</div>
      ) : (
        <ul className="dash-bars">
          {items.map((item) => {
            const width = base > 0 ? Math.max(item.value > 0 ? 3 : 0, Math.round((item.value / base) * 100)) : 0;
            const percent = total && total > 0 ? Math.round((item.value / total) * 100) : null;
            const content = (
              <>
                <span className="dash-bar-label">{item.label}</span>
                <span className="dash-bar-track"><span style={{ width: `${width}%` }} /></span>
                <span className="dash-bar-value">{format(item.value)}{showPercent && percent !== null ? <small> {percent}%</small> : null}</span>
              </>
            );
            return (
              <li key={item.key} className={`dash-bar tone-${item.tone ?? 'blue'}`}>
                {item.to ? <button type="button" className="dash-bar-button" onClick={() => navigate(item.to!)}>{content}</button> : content}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
