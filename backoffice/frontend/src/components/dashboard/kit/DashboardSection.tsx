import type { ReactNode } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';

interface DashboardSectionProps {
  title: string;
  help?: ReactNode;
  action?: ReactNode;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => unknown;
  /** Que se intentaba cargar, para el aviso de error. */
  what: string;
  wide?: boolean;
  children: ReactNode;
}

/** Panel generico del dashboard con titulo, ayuda, estado de carga y de error. */
export default function DashboardSection({ title, help, action, loading, error, onRetry, what, wide, children }: DashboardSectionProps) {
  return (
    <section className={`dash-section${wide ? ' dash-section--wide' : ''}`}>
      <div className="dash-section-head">
        <h2>{title}{help && <span className="metric-info-tooltip" tabIndex={0}><UiIcon name="info" /><span className="metric-info-tooltip-content">{help}</span></span>}</h2>
        {action}
      </div>
      {error ? (
        <QueryErrorNotice error={error} what={what} onRetry={onRetry} />
      ) : loading ? (
        <div aria-busy="true"><span className="dash-skeleton-line" /><span className="dash-skeleton-line dash-skeleton-line--short" /></div>
      ) : children}
    </section>
  );
}
