import { useEffect, useState, type FormEvent } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import type { NivelSuspension } from '@/types/seller';
import { useIsMobile } from '@/hooks/useIsMobile';

export const MOTIVO_SUSPENSION_MIN = 5;
export const MOTIVO_SUSPENSION_MAX = 200;

interface SuspendSellerModalProps {
  isOpen: boolean;
  storeName?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string, nivel: NivelSuspension, duracion?: string) => void;
}

const DURACIONES: Array<[string, string]> = [
  ['3_DIAS', '3 días'],
  ['7_DIAS', '7 días'],
  ['15_DIAS', '15 días'],
  ['1_MES', '1 mes'],
  ['3_MESES', '3 meses'],
];

/**
 * H59: que le pasa a lo que la tienda ya vendio segun el nivel (docs/planes/analisis_suspension_cuentas_h59.md §6).
 * Los textos son para el operador: es la decision mas cara del dialogo.
 */
const NIVELES: Array<{ valor: NivelSuspension; titulo: string; detalle: string }> = [
  {
    valor: 'TEMPORAL',
    titulo: 'Temporal',
    detalle: 'Se reactiva sola al terminar el plazo. La tienda debe despachar lo ya pagado dentro de 2 días hábiles; si no, se cancela y se reembolsa al comprador.',
  },
  {
    valor: 'DEFINITIVA',
    titulo: 'Definitiva',
    detalle: 'Sin plazo, con derecho a apelar. Lo ya pagado se despacha en 2 días hábiles (máximo 72 horas desde hoy); si no, se cancela y se reembolsa.',
  },
  {
    valor: 'FRAUDE',
    titulo: 'Fraude',
    detalle: 'Lo pagado que no ha salido se cancela ahora y se reembolsa al comprador por Flow. Lo que ya va en camino queda en revisión. Úsala solo con evidencia.',
  },
];

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
  const [nivel, setNivel] = useState<NivelSuspension>('DEFINITIVA');
  const [duracion, setDuracion] = useState('7_DIAS');

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setNivel('DEFINITIVA');
      setDuracion('7_DIAS');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MOTIVO_SUSPENSION_MIN;
  const canSubmit = trimmed.length >= MOTIVO_SUSPENSION_MIN && !isSubmitting;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) onConfirm(trimmed, nivel, nivel === 'TEMPORAL' ? duracion : undefined);
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
          <fieldset className="blocked-review-field" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
            <legend style={{ fontWeight: 600, marginBottom: 6 }}>Tipo de suspensión *</legend>
            {NIVELES.map((opcion) => (
              <label
                key={opcion.valor}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', marginBottom: 6,
                  border: `1px solid ${nivel === opcion.valor ? (opcion.valor === 'FRAUDE' ? '#dc2626' : '#2563eb') : '#e2e8f0'}`,
                  borderRadius: 10, cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="nivelSuspension"
                  value={opcion.valor}
                  checked={nivel === opcion.valor}
                  onChange={() => setNivel(opcion.valor)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong style={{ color: opcion.valor === 'FRAUDE' ? '#b91c1c' : undefined }}>{opcion.titulo}</strong>
                  <small style={{ display: 'block', color: '#475569', lineHeight: 1.4 }}>{opcion.detalle}</small>
                </span>
              </label>
            ))}
            {nivel === 'TEMPORAL' && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <span>Duración</span>
                <select className="select" value={duracion} onChange={(e) => setDuracion(e.target.value)} name="duracionSuspension">
                  {DURACIONES.map(([valor, texto]) => (
                    <option key={valor} value={valor}>{texto}</option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>
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
