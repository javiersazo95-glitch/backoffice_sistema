import type { ReactNode } from 'react';
import UiIcon from '@/components/shared/UiIcon';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'default' | 'error';
}

/** Estado vacio o de error para listas moviles. */
export default function EmptyState({ icon = 'list', title, description, action, tone = 'default' }: EmptyStateProps) {
  return (
    <div className={`mb-empty mb-empty--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <span className="mb-empty-icon"><UiIcon name={icon} /></span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && <div className="mb-empty-action">{action}</div>}
    </div>
  );
}
