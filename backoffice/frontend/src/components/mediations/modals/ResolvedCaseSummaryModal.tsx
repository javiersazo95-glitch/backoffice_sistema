import { ResolvedCaseResponse } from '@/types/mediation';
import Modal from '@/components/shared/Modal';
import ModalField from '@/components/shared/ModalField';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { resolveDocumentUrl } from '@/utils/documentUrls';

interface ResolvedCaseSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ResolvedCaseResponse | null;
}

function buildSummary(item: ResolvedCaseResponse): string {
  return `El caso ${item.externalId} registra una mediación ${item.caseKind.toLowerCase()} asociada al pedido ${item.orderId}. Participan ${item.sellerName} y ${item.buyer || 'el comprador'}; el motivo base fue "${item.reason}" y la resolución quedó registrada como "${item.resolutionReason}".`;
}

export default function ResolvedCaseSummaryModal({ isOpen, onClose, item }: ResolvedCaseSummaryModalProps) {
  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resumen del caso" wide>
      <div className="case-modal-header">
        <span className="case-modal-icon violet">
          <UiIcon name="clipboard" />
        </span>
        <div className="case-modal-title">
          <span className="case-modal-kicker">Resumen operativo</span>
          <h2>{item.externalId}</h2>
          <p>{item.sellerName} · {item.buyer || 'Comprador no informado'}</p>
        </div>
      </div>

      <div className="case-modal-body">
        <div className="case-modal-summary">
          <div className="case-modal-status">
            <Badge text={item.sourceStatus || 'Resuelta'} variant={item.sourceStatus || 'resuelta'} />
          </div>
          <div className="case-modal-highlight">
            <span>Resumen del caso</span>
            <strong>{item.reason}</strong>
          </div>
        </div>

        <div className="resolved-summary-quote">
          <UiIcon name="audit" />
          <p>{buildSummary(item)}</p>
        </div>

        <div className="case-modal-grid">
          <ModalField label="Registro" value={item.externalId} />
          <ModalField label="Tipo de caso" value={item.caseKind} />
          <ModalField label="Pedido" value={item.orderId} />
          <ModalField label="Monto" value={formatCurrency(item.amount)} />
          <ModalField label="Vendedor" value={item.sellerName} />
          <ModalField label="Comprador" value={item.buyer || 'No informado'} />
          <ModalField label="Resuelto por" value={item.resolvedBy || 'No informado'} />
          <ModalField label="Fecha de cierre" value={formatDateTime(item.createdAt)} />
          <ModalField label="Documento" value={item.documentName || 'Sin documento'} wide />
          <ModalField label="Estado de origen" value={item.sourceStatus || 'Resuelta'} wide />
          <ModalField label="Resolución" value={item.resolutionReason} wide />
        </div>

        <div className="resolved-summary-footer">
          <div>
            <span>Traza registrada</span>
            <strong>{item.caseKind} · {item.sourceStatus || 'Resuelta'} · {item.externalId}</strong>
          </div>
          {item.documentUrl ? (
            <a
              className="secondary-button compact-link-button"
              href={resolveDocumentUrl(item.documentUrl)}
              target="_blank"
              rel="noreferrer"
            >
              <UiIcon name="document" /> Abrir documento
            </a>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
