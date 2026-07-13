import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: number | string;
  tone: 'blue' | 'amber' | 'violet' | 'red' | 'green';
  description?: string;
  iconName?: string;
  infoContent?: ReactNode;
}

import UiIcon from './UiIcon';

export default function MetricCard({ label, value, tone, description, iconName = 'users', infoContent }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <UiIcon name={iconName} />
      </div>
      <div>
        <h3>{label}{infoContent && <span className="metric-info-tooltip" tabIndex={0}><UiIcon name="info" /><span className="metric-info-tooltip-content">{infoContent}</span></span>}</h3>
        <strong>{value}</strong>
        {description && <p className="metric-description">{description}</p>}
      </div>
    </article>
  );
}
