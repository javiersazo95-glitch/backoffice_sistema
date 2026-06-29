import { useState } from 'react';
import { MediationDetailResponse } from '@/types/mediation';
import Modal from '@/components/shared/Modal';
import ModalField from '@/components/shared/ModalField';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { mediationStatusDisplay } from '@/utils/formatters';

interface CaseResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediationDetailResponse | null;
  mode: 'resolve' | 'reactivate';
  onSubmit: (id: number, reason: string, file: File) => void;
}

export default function CaseResolutionModal({ isOpen, onClose, item, mode, onSubmit }: CaseResolutionModalProps) {
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);

  if (!item) return null;

  const title = mode === 'reactivate' ? 'Reactivar cuenta' : 'Registrar resolución';
  const kicker = mode === 'reactivate' ? 'Cuenta bloqueada o suspendida por mediación' : 'Resolución de caso';
  const buttonLabel = mode === 'reactivate' ? 'Reactivar cuenta' : 'Guardar resolución';
  const kind = item.status === 'ESPERANDO_VENDEDOR' ? 'Esperando al vendedor' : 'Mediación';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !file) return;
    onSubmit(item.id, reason, file);
    setReason('');
    setFile(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} wide>
      <form onSubmit={handleSubmit}>
        <div className="case-modal-header">
          <span className="case-modal-icon green">
            <UiIcon name="check" />
          </span>
          <div className="case-modal-title">
            <span className="case-modal-kicker">{kicker}</span>
            <h2>{item.externalId}</h2>
            <p>{item.sellerName} · {kind} · {item.reason}</p>
          </div>
        </div>

        <div className="case-modal-body">
          <div className="case-modal-summary">
            <div className="case-modal-status">
              <Badge
                text={mediationStatusDisplay(item.status, item.accountBlocked)}
                variant={item.accountBlocked ? 'cuenta-bloqueada' : item.status}
              />
            </div>
            <div className="case-modal-highlight">
              <span>{title}</span>
              <strong>{item.title}</strong>
            </div>
          </div>

          <div className="case-modal-grid">
            <ModalField label="Tipo de caso" value={kind} />
            <ModalField label="Pedido" value={item.orderId} />
            <ModalField label="Tienda" value={item.sellerName} />
            <ModalField label="Comprador" value={item.title.replace('Comprador vs ', '')} />
            <ModalField label="Monto" value={item.amount} />
            <ModalField label="Fecha actual" value={item.updatedAt} />
          </div>

          <label className="message-field">
            <span>Motivo de la resolución o reactivación</span>
            <textarea
              name="reason"
              required
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explica por qué se resolvió de esta forma y deja registro del criterio aplicado..."
            />
          </label>

          <label className="message-field">
            <span>Documento acreditador</span>
            <input
              className="input"
              type="file"
              name="document"
              required
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={!reason.trim() || !file}>
              <UiIcon name="check" /> {buttonLabel}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
