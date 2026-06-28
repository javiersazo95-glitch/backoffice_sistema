import { useState } from 'react';
import DetailRow from '@/components/shared/DetailRow';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';

interface SellerCaseSummaryCardProps {
  tone: 'red' | 'violet' | 'amber';
  icon: string;
  status: string;
  summary: string;
  orderId: string;
  reason: string;
  buyer?: string;
  purchase?: string;
  stage?: string;
  owner?: string;
  updated?: string;
  amount?: string;
  nextAction?: string;
  onPrimaryAction?: () => void;
}

function formatCaseDateTime(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const datePart = new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date).replace('.', '');
  const timePart = new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  return `${datePart} · ${timePart}`;
}

export default function SellerCaseSummaryCard({
  tone,
  icon,
  status,
  summary,
  orderId,
  buyer,
  stage,
  owner,
  updated,
  amount,
  nextAction,
  onPrimaryAction,
}: SellerCaseSummaryCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const visibleOrder = orderId && orderId !== 'N/A' ? orderId : 'Sin pedido asociado';
  const subtitleParts = [visibleOrder, stage, amount].filter(Boolean);
  const headerSubtitle = subtitleParts.join(' · ');
  const isMediation = tone === 'violet';
  const statusNode = isMediation ? (
    <span className="seller-case-summary-status-text violet">{status}</span>
  ) : (
    <Badge text={status} variant={status} />
  );
  const actionLabel = isMediation ? 'Revisar mediación' : 'Tomar acción';
  const actionIcon = isMediation ? 'scale' : 'trendUp';
  const collapseToggleToneClass = isMediation ? 'mediation-state-violet' : 'account-lock-action';
  const displayUpdated = formatCaseDateTime(updated);
  const detailRows = [
    ['Pedido', visibleOrder],
    ['Comprador', buyer || 'Comprador'],
    stage ? ['Etapa', stage] : null,
    owner ? ['Responsable', owner] : null,
    displayUpdated ? ['Fecha reporte', displayUpdated] : null,
    amount ? ['Monto', amount] : null,
    nextAction ? ['Siguiente acción', nextAction] : null,
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <article className={`seller-case-summary tone-${tone} ${isOpen ? 'open' : ''}`}>
      <button
        className="seller-case-summary-head"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? `Cerrar detalle de ${summary}` : `Abrir detalle de ${summary}`}
      >
        <span className={`seller-case-summary-icon ${tone}`}>
          <UiIcon name={icon} />
        </span>
        <span className="seller-case-summary-copy" aria-hidden="true">
          <span className="seller-case-summary-title-row">
            <strong>{summary}</strong>
            <span className="seller-case-summary-status">{statusNode}</span>
          </span>
          <span className="seller-case-summary-subtitle">{headerSubtitle}</span>
        </span>
        <span className="seller-case-summary-actions">
          <span className={`row-action collapse-toggle ${collapseToggleToneClass} ${isOpen ? 'open' : ''}`}>
            <UiIcon name="chevronDown" />
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="seller-case-summary-context">
          <div className="seller-case-section-title">
            <UiIcon name="document" />
            <h4>Detalles del caso</h4>
          </div>
          <div className="seller-case-details">
            {detailRows.map(([label, value]) => (
              <DetailRow key={label} label={label} value={value} />
            ))}
          </div>
          {isMediation && (
            <div className="seller-case-activity">
              <span className="seller-case-activity-icon">
                <UiIcon name="clock" />
              </span>
              <div>
                <strong>Actividad reciente</strong>
                <p>{displayUpdated || 'Sin fecha informada'} · {stage || status}</p>
                {owner ? <small>Por {owner}</small> : null}
              </div>
            </div>
          )}
          {onPrimaryAction && (
            <button className={`seller-case-primary-action ${tone}`} type="button" onClick={onPrimaryAction}>
              <UiIcon name={actionIcon} />
              <span>{actionLabel}</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
