import { useEffect, useState, type FormEvent } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { useIsMobile } from '@/hooks/useIsMobile';

export const MOTIVO_SUSPENSION_MIN = 5;
export const MOTIVO_SUSPENSION_MAX = 200;

interface SuspendSellerModalProps {
  isOpen: boolean;
  storeName?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * H62 (pruebas de lanzamiento, 30-sep): "Bloquear tienda" mandaba un motivo fijo ("Bloqueado
 * desde perfil") que llegaba tal cual al correo, la notificacion, el banner y la apelacion de
 * la tienda. El operador escribe el motivo, con el mismo minimo que la suspension por mediacion.
 * Lo usan Vendedores y Mediaciones, que antes llamaban endpoints distintos (H63).
 */
export default function SuspendSellerModal({ isOpen, storeName, isSubmitting = false, onClose, onConfirm }: SuspendSellerModalProps) {
  const isMobile = useIsMobile();
  useLockBodyScroll(isOpen && isMobile);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOpen) setReason('');
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MOTIVO_SUSPENSION_MIN;
  const canSubmit = trimmed.length >= MOTIVO_SUSPENSION_MIN && !isSubmitting;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) onConfirm(trimmed);
  };

  return (
    <div className="case-modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="case-modal" role="dialog" aria-modal="true" aria-labelledby="suspend-seller-title" onClick={(e) => e.stopPropagation()}>
        <div className="case-modal-header">
          <span className="case-modal-icon" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
            <UiIcon name="shieldX" />
          </span>
          <div className="case-modal-title">
            <h2 id="suspend-seller-title">Suspender tienda</h2>
            {storeName && <p>{storeName}</p>}
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <form className="case-modal-body" onSubmit={handleSubmit}>
          <p className="row-sub">
            La tienda deja de vender y sus productos se ocultan. El motivo le llega por correo y
            notificación, y lo verá en el aviso de suspensión y al solicitar la revisión.
          </p>
          <label className="blocked-review-field">
            <span>Motivo de la suspensión *</span>
            <textarea
              name="suspensionReason"
              rows={4}
              maxLength={MOTIVO_SUSPENSION_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: publica repuestos usados como nuevos y no respondió a los reclamos."
              autoFocus
            />
          </label>
          {tooShort && (
            <small style={{ color: '#dc2626' }}>El motivo debe contener al menos {MOTIVO_SUSPENSION_MIN} caracteres.</small>
          )}
          <div className="blocked-review-footer">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-button danger-primary-button" type="submit" disabled={!canSubmit}>
              <UiIcon name="shieldX" /> {isSubmitting ? 'Suspendiendo…' : 'Suspender tienda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
