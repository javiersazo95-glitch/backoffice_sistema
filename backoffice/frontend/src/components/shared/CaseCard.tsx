import { useState } from 'react';
import UiIcon from './UiIcon';
import Badge from './Badge';
import DetailRow from './DetailRow';

interface CaseCardProps {
  id: string;
  sellerId: number;
  seller: string;
  status: string;
  reason: string;
  orderId: string;
  type: 'risk' | 'impact' | 'resolved';
  amount?: string;
  updated?: string;
  stage?: string;
  owner?: string;
  resolvedDate?: string;
  resolvedBy?: string;
  resolutionReason?: string;
  documentName?: string;
  purchase?: string;
  buyer?: string;
  nextAction?: string;
  onOpenSeller?: (sellerId: number) => void;
  onOpenCase?: (caseId: string) => void;
}

export default function CaseCard({
  id,
  status,
  reason,
  orderId,
  type,
  amount,
  updated,
  stage,
  owner,
  resolvedDate,
  resolvedBy,
  resolutionReason,
  documentName,
  buyer,
  nextAction,
  onOpenCase,
}: CaseCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const iconTone = type === 'risk' ? 'red' : type === 'impact' ? 'violet' : 'green';
  const iconName = type === 'risk' ? 'trendUp' : type === 'impact' ? 'scale' : 'check';
  const subtitle = `${reason} · ${orderId}${amount ? ` · ${amount}` : ''}`;
  const actionLabel = type === 'impact' ? 'Revisar mediación' : 'Tomar acción';
  const actionIcon = type === 'impact' ? 'scale' : 'trendUp';
  const supportingIcon = type === 'impact' ? 'clock' : 'target';
  const supportingTitle = type === 'impact' ? 'Actividad reciente' : 'Próximo paso';
  const supportingCopy = type === 'impact'
    ? `${updated || 'Sin fecha informada'} · ${stage || status}`
    : nextAction || 'Revisar reincidencia y definir medida correctiva.';
  const detailRows = [
    ['Pedido', orderId],
    ['Comprador', buyer || 'Comprador'],
    stage ? ['Etapa', stage] : null,
    owner ? ['Responsable', owner] : null,
    updated ? ['Actualización', updated] : null,
    amount ? ['Monto', amount] : null,
    type === 'impact' && nextAction ? ['Siguiente acción', nextAction] : null,
    type === 'resolved' && resolvedDate ? ['Fecha', resolvedDate] : null,
    type === 'resolved' && resolvedBy ? ['Resuelto por', resolvedBy] : null,
    type === 'resolved' && resolutionReason ? ['Motivo de resolución', resolutionReason] : null,
    type === 'resolved' && documentName ? ['Documento acreditador', documentName] : null,
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <article className={`seller-signal-card collapsible-case-card ${type === 'resolved' ? 'resolved-case-card' : ''} ${isOpen ? 'open' : ''}`}>
      <div className="signal-head">
        <span className={`status-icon ${iconTone}`}>
          <UiIcon name={iconName} />
        </span>
        <div className="signal-copy">
          <strong>{reason}</strong>
          <span className="signal-status-line">
            {type === 'impact' ? <strong>En mediación</strong> : <Badge text={status} variant={status} />}
          </span>
          <span>{subtitle}</span>
        </div>
        <div className="signal-card-actions">
          <button
            className={`row-action collapse-toggle ${iconTone === 'violet' ? 'mediation-state-violet' : 'account-lock-action'} ${isOpen ? 'open' : ''}`}
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Cerrar detalle' : 'Abrir detalle'}
          >
            <UiIcon name="chevronDown" />
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="case-expanded-content">
          <div className="case-expanded-title">
            <UiIcon name="document" />
            <h3>Detalles del caso</h3>
          </div>
          <div className="case-expanded-grid">
            {detailRows.map(([label, value]) => (
              <DetailRow key={label} label={label} value={value} />
            ))}
          </div>
          <div className={`case-support-box ${iconTone}`}>
            <span>
              <UiIcon name={supportingIcon} />
            </span>
            <div>
              <strong>{supportingTitle}</strong>
              <p>{supportingCopy}</p>
              {type === 'impact' && owner ? <small>Por {owner}</small> : null}
            </div>
          </div>
          {type !== 'resolved' && (
            <button className={`case-primary-action ${iconTone}`} type="button" onClick={() => onOpenCase?.(id)}>
              <UiIcon name={actionIcon} />
              <span>{actionLabel}</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
