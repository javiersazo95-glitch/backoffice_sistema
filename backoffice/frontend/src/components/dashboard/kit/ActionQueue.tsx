import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import UiIcon from '@/components/shared/UiIcon';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import { useIsMobile } from '@/hooks/useIsMobile';
import { RecordCard, RecordList, EmptyState } from '@/components/mobile';

export interface ActionQueueItem {
  id: string | number;
  title: ReactNode;
  subtitle?: ReactNode;
  /** "hace 3 d", "vence hoy". */
  ageLabel: string;
  ageTone: 'blue' | 'amber' | 'red';
  badge?: ReactNode;
  amount?: string;
  onOpen: () => void;
  openLabel?: string;
}

interface ActionQueueProps {
  title: string;
  /** Tooltip de ayuda del titulo. */
  help?: ReactNode;
  items: ActionQueueItem[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => unknown;
  /** Que se intentaba cargar, para el aviso de error: "las mediaciones". */
  what: string;
  emptyText: string;
  max?: number;
  seeAllTo?: string;
  seeAllLabel?: string;
}

const TONE_TO_CARD = { blue: 'default', amber: 'warning', red: 'danger' } as const;

/**
 * Cola de trabajo: los N casos mas antiguos o urgentes, con su antiguedad y un boton para
 * abrirlos. Es la respuesta a "por donde empiezo".
 */
export default function ActionQueue({ title, help, items, loading, error, onRetry, what, emptyText, max = 5, seeAllTo, seeAllLabel = 'Ver todos' }: ActionQueueProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const visible = items.slice(0, max);

  const head = (
    <div className="dash-section-head">
      <h2>
        {title}
        {help && <span className="metric-info-tooltip" tabIndex={0}><UiIcon name="info" /><span className="metric-info-tooltip-content">{help}</span></span>}
      </h2>
      {seeAllTo && <button type="button" className="dash-link-button" onClick={() => navigate(seeAllTo)}>{seeAllLabel} <UiIcon name="arrowRight" /></button>}
    </div>
  );

  if (error) {
    return <section className="dash-section">{head}<QueryErrorNotice error={error} what={what} onRetry={onRetry} /></section>;
  }

  if (isMobile) {
    return (
      <section className="dash-section">
        {head}
        <RecordList loading={loading} skeletonCount={3} ariaLabel={title} empty={<EmptyState icon="check" title="Nada pendiente" description={emptyText} />}>
          {visible.map((item) => (
            <RecordCard
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              badge={item.badge}
              tone={TONE_TO_CARD[item.ageTone]}
              meta={[{ label: 'Antigüedad', value: item.ageLabel }, ...(item.amount ? [{ label: 'Monto', value: item.amount }] : [])]}
              onPress={item.onOpen}
            />
          ))}
        </RecordList>
      </section>
    );
  }

  return (
    <section className="dash-section">
      {head}
      {loading ? (
        <div className="dash-queue" aria-busy="true">
          {[0, 1, 2].map((index) => <div key={index} className="dash-queue-row dash-queue-row--skeleton"><span className="dash-skeleton-line" /><span className="dash-skeleton-line dash-skeleton-line--short" /></div>)}
        </div>
      ) : visible.length === 0 ? (
        <div className="dash-empty"><UiIcon name="check" /> {emptyText}</div>
      ) : (
        <ol className="dash-queue">
          {visible.map((item) => (
            <li key={item.id} className={`dash-queue-row tone-${item.ageTone}`}>
              <span className="dash-queue-dot" aria-hidden="true" />
              <div className="dash-queue-copy">
                <strong>{item.title}</strong>
                {item.subtitle && <span>{item.subtitle}</span>}
              </div>
              <div className="dash-queue-meta">
                {item.badge}
                {item.amount && <b>{item.amount}</b>}
                <small className={`dash-age tone-${item.ageTone}`}>{item.ageLabel}</small>
              </div>
              <button type="button" className="secondary-button dash-queue-open" onClick={item.onOpen}>{item.openLabel ?? 'Abrir'}</button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
