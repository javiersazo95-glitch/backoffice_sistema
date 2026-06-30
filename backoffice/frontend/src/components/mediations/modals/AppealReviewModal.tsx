import { useEffect, useState, type FormEvent } from 'react';
import type { MediationResponse } from '@/types/mediation';
import { useMediation } from '@/hooks/useMediations';
import Modal from '@/components/shared/Modal';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { formatDateTime } from '@/utils/formatters';

interface AppealReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediationResponse | null;
  isSubmitting?: boolean;
  onReactivate: (id: number, reason: string, file: File) => void;
}

export default function AppealReviewModal({
  isOpen,
  onClose,
  item,
  isSubmitting = false,
  onReactivate,
}: AppealReviewModalProps) {
  const { data: detail, isLoading } = useMediation(item?.id ?? 0);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setFile(null);
    }
  }, [isOpen]);

  if (!item) return null;

  const appealMessage = (() => {
    const messages = detail?.messages ?? [];
    const vendorMsg = [...messages]
      .reverse()
      .find((m) => !m.internal && (m.senderRole?.toLowerCase().includes('vendedor') || m.author?.toLowerCase().includes('vendedor')));
    return vendorMsg?.text || item.escalationReason || item.reason || 'Sin mensaje de apelación registrado.';
  })();

  const appealDate = (() => {
    const messages = detail?.messages ?? [];
    const vendorMsg = [...messages]
      .reverse()
      .find((m) => !m.internal && (m.senderRole?.toLowerCase().includes('vendedor') || m.author?.toLowerCase().includes('vendedor')));
    return vendorMsg?.createdAt ? formatDateTime(vendorMsg.createdAt) : undefined;
  })();

  const canSubmit = Boolean(reason.trim() && file && !isSubmitting);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !file) return;
    onReactivate(item.id, reason.trim(), file);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Apelación del vendedor" wide>
      <div className="case-modal-header">
        <span className="case-modal-icon appeal">
          <UiIcon name="flag" />
        </span>
        <div className="case-modal-title">
          <span className="case-modal-kicker">Solicitud de revisión</span>
          <h2>{item.sellerName}</h2>
          <p>{item.externalId} · Pedido {item.orderId}</p>
        </div>
        <Badge text="Solicitud de revisión" variant="appeal" />
      </div>

      <div className="case-modal-body">

        {/* Mensaje de apelación */}
        <div className="appeal-message-section">
          <div className="appeal-message-label">
            <UiIcon name="message" />
            <span>Mensaje de apelación del vendedor</span>
            {appealDate && <span className="appeal-message-date">{appealDate}</span>}
          </div>
          {isLoading ? (
            <p className="appeal-message-body appeal-message-loading">Cargando mensaje...</p>
          ) : (
            <p className="appeal-message-body">{appealMessage}</p>
          )}
        </div>

        {/* Formulario de resolución */}
        <div className="appeal-resolution-section">
          <div className="appeal-resolution-header">
            <span className="resolved-timeline-stage-icon">
              <UiIcon name="refresh" />
            </span>
            <div>
              <h3>Resolución de apelación</h3>
              <p>Para reactivar la cuenta debes registrar el motivo de la resolución y adjuntar el documento de respaldo.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="appeal-resolution-form">
            <label className="blocked-review-field">
              <span>Motivo de resolución *</span>
              <textarea
                name="resolutionReason"
                required
                rows={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Registra el motivo por el que corresponde reactivar esta cuenta..."
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
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {file && <span className="blocked-review-file-name">{file.name}</span>}
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
        </div>
      </div>
    </Modal>
  );
}
