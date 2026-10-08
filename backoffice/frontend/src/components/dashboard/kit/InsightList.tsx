import { useNavigate } from 'react-router-dom';
import UiIcon from '@/components/shared/UiIcon';

export interface Insight {
  id: string;
  tone: 'ok' | 'warn' | 'alert';
  text: string;
  actionLabel?: string;
  to?: string;
  onAction?: () => void;
}

interface InsightListProps {
  title?: string;
  items: Insight[];
  loading?: boolean;
}

const ICON = { ok: 'check', warn: 'clock', alert: 'alert' } as const;

/**
 * "Sugerencias de hoy": frases en lenguaje simple que salen de los datos y de umbrales
 * conocidos ("3 tickets llevan mas de 24 h sin respuesta"), cada una con un boton a la pantalla
 * donde se resuelve. Las arma cada area en su archivo `*.insights.ts`, sin UI, para poder
 * probarlas.
 */
export default function InsightList({ title = 'Sugerencias de hoy', items, loading }: InsightListProps) {
  const navigate = useNavigate();
  return (
    <section className="dash-section dash-insights">
      <div className="dash-section-head"><h2><UiIcon name="sparkles" /> {title}</h2></div>
      {loading ? (
        <div aria-busy="true"><span className="dash-skeleton-line" /><span className="dash-skeleton-line dash-skeleton-line--short" /></div>
      ) : (
        <ul className="dash-insight-list">
          {items.map((item) => (
            <li key={item.id} className={`dash-insight dash-insight--${item.tone}`}>
              <span className="dash-insight-icon"><UiIcon name={ICON[item.tone]} /></span>
              <p>{item.text}</p>
              {(item.to || item.onAction) && item.actionLabel && (
                <button type="button" className="secondary-button" onClick={() => (item.onAction ? item.onAction() : item.to && navigate(item.to))}>
                  {item.actionLabel}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
