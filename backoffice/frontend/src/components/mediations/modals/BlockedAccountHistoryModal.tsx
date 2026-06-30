import type { MediationResponse } from '@/types/mediation';
import { useMediation } from '@/hooks/useMediations';
import Modal from '@/components/shared/Modal';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { formatDateTime } from '@/utils/formatters';
import { resolveDocumentUrl } from '@/utils/documentUrls';

interface BlockedAccountHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediationResponse | null;
}

interface TimelineStageProps {
  label: string;
  variant: string;
  icon: string;
  date?: string;
  children: React.ReactNode;
  isLast?: boolean;
}

function TimelineStage({ label, variant, icon, date, children, isLast = false }: TimelineStageProps) {
  return (
    <div className={`resolved-timeline-stage${isLast ? ' resolved-timeline-stage--last' : ''}`}>
      <div className="resolved-timeline-connector">
        <span className="resolved-timeline-dot" />
        {!isLast && <span className="resolved-timeline-line" />}
      </div>
      <div className="resolved-timeline-content">
        <div className="resolved-timeline-stage-header">
          <span className="resolved-timeline-stage-icon">
            <UiIcon name={icon} />
          </span>
          <Badge text={label} variant={variant} />
          {date && <span className="resolved-timeline-stage-date">{date}</span>}
        </div>
        <div className="resolved-timeline-stage-body">{children}</div>
      </div>
    </div>
  );
}

function DocLink({ name, url }: { name: string; url: string }) {
  return (
    <a
      className="resolved-timeline-doc-link"
      href={resolveDocumentUrl(url)}
      target="_blank"
      rel="noreferrer"
    >
      <UiIcon name="document" />
      <span>{name || 'Documento adjunto'}</span>
    </a>
  );
}

export default function BlockedAccountHistoryModal({ isOpen, onClose, item }: BlockedAccountHistoryModalProps) {
  const { data: detail, isLoading } = useMediation(item?.id ?? 0);

  if (!item) return null;

  const buyerDocs = detail?.buyerEvidence ?? [];
  const sellerDocs = detail?.sellerEvidence ?? [];
  const allDocs = [...buyerDocs, ...sellerDocs];

  const aperturaDate = detail?.createdAt ? formatDateTime(detail.createdAt) : undefined;
  const mediacionDate = detail?.updatedAt ? formatDateTime(detail.updatedAt) : undefined;
  const bloqueoDate = item.updatedAt ? formatDateTime(item.updatedAt) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Historial del bloqueo" wide>
      <div className="case-modal-header">
        <span className="case-modal-icon danger">
          <UiIcon name="lock" />
        </span>
        <div className="case-modal-title">
          <span className="case-modal-kicker">Historial de la mediación</span>
          <h2>{item.externalId}</h2>
          <p>{item.sellerName} · Pedido {item.orderId}</p>
        </div>
      </div>

      <div className="case-modal-body">
        {isLoading ? (
          <div className="resolved-timeline-loading">
            <span className="row-sub">Cargando historial del caso...</span>
          </div>
        ) : (
          <div className="resolved-timeline">

            {/* Etapa 1: Apertura */}
            <TimelineStage label="Apertura" variant="esperando-vendedor" icon="alert" date={aperturaDate}>
              <div className="resolved-timeline-fields">
                <div className="resolved-timeline-field">
                  <span className="resolved-timeline-field-label">Motivo</span>
                  <span className="resolved-timeline-field-value">{item.escalationReason || item.reason || 'No especificado'}</span>
                </div>
                <div className="resolved-timeline-field">
                  <span className="resolved-timeline-field-label">Tienda</span>
                  <span className="resolved-timeline-field-value">{item.sellerName}</span>
                </div>
                {item.buyer && (
                  <div className="resolved-timeline-field">
                    <span className="resolved-timeline-field-label">Comprador</span>
                    <span className="resolved-timeline-field-value">{item.buyer}</span>
                  </div>
                )}
                <div className="resolved-timeline-field">
                  <span className="resolved-timeline-field-label">Pedido</span>
                  <span className="resolved-timeline-field-value">{item.orderId}</span>
                </div>
                {(detail?.owner || item.owner) && (
                  <div className="resolved-timeline-field">
                    <span className="resolved-timeline-field-label">Responsable</span>
                    <span className="resolved-timeline-field-value">{detail?.owner || item.owner}</span>
                  </div>
                )}
              </div>
            </TimelineStage>

            {/* Etapa 2: En mediación */}
            <TimelineStage label="En mediación" variant="en-mediacion" icon="scale" date={mediacionDate}>
              <div className="resolved-timeline-fields">
                <div className="resolved-timeline-field">
                  <span className="resolved-timeline-field-label">Responsable</span>
                  <span className="resolved-timeline-field-value">{detail?.owner || item.owner || 'Mediador'}</span>
                </div>
              </div>
              {allDocs.length > 0 && (
                <div className="resolved-timeline-docs">
                  <span className="resolved-timeline-docs-label">Documentos adjuntos</span>
                  <div className="resolved-timeline-docs-list">
                    {allDocs.map((doc) => (
                      <DocLink key={doc.id} name={doc.fileName || `Documento (${doc.actorRole || doc.source || 'adjunto'})`} url={doc.url} />
                    ))}
                  </div>
                </div>
              )}
              {allDocs.length === 0 && (
                <p className="resolved-timeline-empty-docs">Sin documentos adjuntos en esta etapa.</p>
              )}
            </TimelineStage>

            {/* Etapa 3: Veredicto — Cuenta bloqueada */}
            <TimelineStage label="Cuenta bloqueada" variant="cuenta-bloqueada" icon="lock" date={bloqueoDate} isLast>
              <div className="resolved-timeline-fields">
                <div className="resolved-timeline-field">
                  <span className="resolved-timeline-field-label">Estado</span>
                  <span className="resolved-timeline-field-value">{item.displayStatus || 'Cuenta bloqueada'}</span>
                </div>
                <div className="resolved-timeline-field">
                  <span className="resolved-timeline-field-label">Responsable</span>
                  <span className="resolved-timeline-field-value">{item.owner || 'No informado'}</span>
                </div>
                <div className="resolved-timeline-field">
                  <span className="resolved-timeline-field-label">Etapa</span>
                  <span className="resolved-timeline-field-value">{item.stage || 'No informada'}</span>
                </div>
                {item.nextAction && (
                  <div className="resolved-timeline-field">
                    <span className="resolved-timeline-field-label">Siguiente acción</span>
                    <span className="resolved-timeline-field-value">{item.nextAction}</span>
                  </div>
                )}
              </div>
              {detail?.documentUrl && (
                <div className="resolved-timeline-docs">
                  <span className="resolved-timeline-docs-label">Documento del caso</span>
                  <div className="resolved-timeline-docs-list">
                    <DocLink name={detail.documentName || 'Documento adjunto'} url={detail.documentUrl} />
                  </div>
                </div>
              )}
            </TimelineStage>

          </div>
        )}
      </div>
    </Modal>
  );
}
