interface MetricCardProps {
  label: string;
  value: number | string;
  tone: 'blue' | 'amber' | 'violet' | 'red' | 'green';
  description?: string;
  iconName?: string;
}

import UiIcon from './UiIcon';

export default function MetricCard({ label, value, tone, description, iconName = 'users' }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <UiIcon name={iconName} />
      </div>
      <div>
        <h3>{label}</h3>
        <strong>{value}</strong>
        {description && <p className="metric-description">{description}</p>}
      </div>
    </article>
  );
}
