import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: number | string;
  tone: 'blue' | 'amber' | 'violet' | 'red' | 'green';
  description?: string;
  iconName?: string;
  infoContent?: ReactNode;
  /** La "i" abre un desglose en vez de un tooltip. */
  onInfoClick?: () => void;
}

import UiIcon from './UiIcon';

export default function MetricCard({ label, value, tone, description, iconName = 'users', infoContent, onInfoClick }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <UiIcon name={iconName} />
      </div>
      <div>
        <h3>{label}{onInfoClick && <button type="button" className="metric-info-button" onClick={onInfoClick} title="Ver el desglose" aria-label={`Ver desglose de ${label}`}><UiIcon name="info" /></button>}{infoContent && <span className="metric-info-tooltip" tabIndex={0}><UiIcon name="info" /><span className="metric-info-tooltip-content">{infoContent}</span></span>}</h3>
        <strong>{value}</strong>
        {description && <p className="metric-description">{description}</p>}
      </div>
    </article>
  );
}
