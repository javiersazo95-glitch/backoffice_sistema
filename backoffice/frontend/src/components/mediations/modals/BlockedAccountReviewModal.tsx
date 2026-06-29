import { useEffect, useState, type FormEvent } from 'react';
import type { MediationResponse } from '@/types/mediation';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { formatCurrency, formatDateTime, mediationStatusDisplay } from '@/utils/formatters';

interface BlockedAccountReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediationResponse | null;
  isSubmitting?: boolean;
  onReactivate: (id: number, reason: string, file: File) => void;
}

function buildBlockedSummary(item: MediationResponse): string {
  const reason = item.escalationReason || item.reason || 'No hay motivo registrado';
  const nextAction = item.nextAction || 'Sin siguiente acción registrada';
  return `La cuenta de ${item.sellerName} permanece bloqueada por el caso ${item.externalId}, asociado al pedido ${item.orderId}. El motivo registrado es "${reason}". La etapa actual es "${item.stage || item.status}" y la responsable es ${item.owner || 'no informada'}, con ${nextAction}.`;
}

export default function BlockedAccountReviewModal({
  isOpen,
  onClose,
  item,
  isSubmitting = false,
  onReactivate,
}: BlockedAccountReviewModalProps) {
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setFile(null);
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const blockReason = item.escalationReason || item.reason || 'Motivo no informado';
  const canSubmit = Boolean(reason.trim() && file && !isSubmitting);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !file) return;
    onReactivate(item.id, reason.trim(), file);
  };

  return (
    <div className="case-modal-backdrop blocked-review-backdrop" onClick={onClose}>
      <div className="blocked-review-modal" onClick={(event) => event.stopPropagation()}>
        <div className="blocked-review-shell">
          <div className="blocked-review-header">
            <div className="blocked-review-brand">
              <span className="blocked-review-icon">
                <UiIcon name="lock" />
              </span>
              <div className="blocked-review-title">
                <span className="blocked-review-kicker">Cuenta bloqueada</span>
                <h2>{item.sellerName}</h2>
                <p>{item.externalId} · Pedido {item.orderId}</p>
              </div>
            </div>

            <div className="blocked-review-status">
              <Badge text="Cuenta bloqueada" variant="cuenta-bloqueada" />
            </div>

            <div className="blocked-review-reason">
              <span>Motivo del bloqueo</span>
              <strong>{blockReason}</strong>
            </div>
          </div>

          <div className="blocked-review-quote">
            <span>
              <UiIcon name="info" />
            </span>
            <p>{buildBlockedSummary(item)}</p>
          </div>

          <section className="blocked-review-data-strip">
            <div className="blocked-review-data-item">
              <span className="blocked-review-data-icon">
                <UiIcon name="document" />
              </span>
              <div>
                <small>Registro</small>
                <strong>{item.externalId}</strong>
              </div>
            </div>
            <div className="blocked-review-data-item">
              <span className="blocked-review-data-icon">
                <UiIcon name="users" />
              </span>
              <div>
                <small>Tienda</small>
                <strong>{item.sellerName}</strong>
              </div>
            </div>
            <div className="blocked-review-data-item">
              <span className="blocked-review-data-icon">
                <UiIcon name="cart" />
              </span>
              <div>
                <small>Pedido</small>
                <strong>{item.orderId}</strong>
              </div>
            </div>
            <div className="blocked-review-data-item">
              <span className="blocked-review-data-icon">
                <UiIcon name="wallet" />
              </span>
              <div>
                <small>Monto</small>
                <strong>{formatCurrency(item.amount)}</strong>
              </div>
            </div>
            <div className="blocked-review-data-item">
              <span className="blocked-review-data-icon danger">
                <UiIcon name="lock" />
              </span>
              <div>
                <small>Estado</small>
                <strong className="danger">{mediationStatusDisplay(item.status, true)}</strong>
              </div>
            </div>
          </section>

          <section className="blocked-review-grid">
            <div className="blocked-review-summary-card">
              <div className="blocked-review-section-head">
                <span className="blocked-review-section-icon">
                  <UiIcon name="list" />
                </span>
                <h3>Resumen del bloqueo</h3>
              </div>

              <div className="blocked-review-summary-rows">
                <div className="blocked-review-summary-row">
                  <span>Etapa</span>
                  <strong>{item.stage || 'No informada'}</strong>
                </div>
                <div className="blocked-review-summary-row">
                  <span>Responsable</span>
                  <strong>{item.owner || 'No informado'}</strong>
                </div>
                <div className="blocked-review-summary-row">
                  <span>Última actualización</span>
                  <strong>{formatDateTime(item.updatedAt)}</strong>
                </div>
                <div className="blocked-review-summary-row wide">
                  <span>Caso</span>
                  <strong>{item.title || 'No informado'}</strong>
                </div>
              </div>
            </div>

            <div className="blocked-review-case-card">
              <div className="blocked-review-section-head">
                <span className="blocked-review-section-icon blue">
                  <UiIcon name="document" />
                </span>
                <h3>Datos del caso</h3>
              </div>

              <p className="blocked-review-case-copy">
                El caso {item.externalId} está asociado al pedido {item.orderId} y se mantiene bajo la etapa actual de {item.stage || 'mediación crítica'}.
              </p>

              <div className="blocked-review-next-action">
                <div className="blocked-review-next-action-icon">
                  <UiIcon name="target" />
                </div>
                <div>
                  <span>Siguiente acción</span>
                  <strong>{item.nextAction || 'Sin siguiente acción registrada.'}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="blocked-review-reactivate-card">
            <div className="blocked-review-section-head">
              <span className="blocked-review-section-icon blue">
                <UiIcon name="refresh" />
              </span>
              <div>
                <h3>Reactivar cuenta</h3>
                <p>Para reactivar la cuenta, debes registrar la justificación por escrito y adjuntar un documento de respaldo.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="blocked-review-form">
              <label className="blocked-review-field">
                <span>Motivo de reactivación *</span>
                <textarea
                  name="reactivationReason"
                  required
                  rows={6}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Registra por qué corresponde reactivar esta cuenta y qué respaldo se revisó..."
                />
              </label>

              <label className="blocked-review-upload">
                <span>Documento de respaldo *</span>
                <div className="blocked-review-dropzone">
                  <UiIcon name="upload" />
                  <div>
                    <strong>Arrastra y suelta tu archivo aquí</strong>
                    <span>o selecciona desde tu dispositivo</span>
                    <button type="button" className="blocked-review-upload-button">
                      Seleccionar archivo
                    </button>
                    <small>Formatos permitidos: PDF, JPG, PNG</small>
                  </div>
                  <input
                    className="blocked-review-file-input"
                    type="file"
                    name="document"
                    required
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                {file ? <span className="blocked-review-file-name">{file.name}</span> : null}
              </label>

              <div className="blocked-review-footer">
                <button className="secondary-button" type="button" onClick={onClose}>
                  Cancelar
                </button>
                <button className="primary-button danger-primary-button" type="submit" disabled={!canSubmit}>
                  <UiIcon name="check" /> {isSubmitting ? 'Reactivando...' : 'Reactivar cuenta'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
