import type { ReactNode } from 'react';

interface RecordListProps {
  loading?: boolean;
  skeletonCount?: number;
  /** Se muestra cuando no hay children (y no esta cargando). */
  empty?: ReactNode;
  children?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

function Skeleton() {
  return (
    <div className="mb-record mb-skeleton" aria-hidden="true">
      <div className="mb-record-head">
        <div className="mb-record-titles">
          <span className="mb-skeleton-line" style={{ width: '62%' }} />
          <span className="mb-skeleton-line mb-skeleton-line--thin" style={{ width: '40%' }} />
        </div>
        <span className="mb-skeleton-pill" />
      </div>
      <div className="mb-record-meta">
        <span className="mb-skeleton-line mb-skeleton-line--thin" />
        <span className="mb-skeleton-line mb-skeleton-line--thin" />
        <span className="mb-skeleton-line mb-skeleton-line--thin" />
        <span className="mb-skeleton-line mb-skeleton-line--thin" />
      </div>
    </div>
  );
}

/** Contenedor de tarjetas con estados de carga y vacio. */
export default function RecordList({ loading = false, skeletonCount = 4, empty, children, className = '', ariaLabel }: RecordListProps) {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children);

  if (loading) {
    return (
      <div className={`mb-list ${className}`.trim()} aria-busy="true" aria-label={ariaLabel}>
        {Array.from({ length: skeletonCount }, (_, index) => <Skeleton key={index} />)}
      </div>
    );
  }

  if (!hasChildren) {
    return <div className={`mb-list ${className}`.trim()} aria-label={ariaLabel}>{empty}</div>;
  }

  return (
    <div className={`mb-list ${className}`.trim()} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
