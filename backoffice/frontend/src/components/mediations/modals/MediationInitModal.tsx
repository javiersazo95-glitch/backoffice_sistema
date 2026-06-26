import { useEffect, useState, type FormEvent } from 'react';
import type { MediationDetailResponse } from '@/types/mediation';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { formatCurrency, mediationEscalationReason, mediationStatusDisplay } from '@/utils/formatters';

interface MediationInitModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediationDetailResponse | null;
  onSubmit: (id: number, message: string) => void;
  isSubmitting?: boolean;
}

function buildCaseSummary(item: MediationDetailResponse): string[] {
  return [
    `Comprador: ${item.buyer || item.title.replace('Comprador vs ', '')}`,
    `Vendedor: ${item.sellerName}`,
    `Motivo: ${item.reason}`,
    `Monto involucrado: ${formatCurrency(item.amount)}`,
    `Estado actual: ${item.status}`,
  ];
}

function initKeyRows(item: MediationDetailResponse) {
  return [
    {
      icon: 'flag',
      label: 'Estado',
      value: (
        <Badge
          text={mediationStatusDisplay(item.status, item.accountBlocked)}
          variant={item.accountBlocked ? 'cuenta-bloqueada' : item.status}
        />
      ),
    },
    {
      icon: 'clock',
      label: 'Tiempo transcurrido',
      value: item.elapsed,
    },
    {
      icon: 'alert',
      label: 'Causa',
      value: item.escalationType || 'Sin respuesta vendedor',
    },
    {
      icon: 'cart',
      label: 'Pedido',
      value: item.orderId,
    },
    {
      icon: 'cube',
      label: 'Motivo',
      value: item.reason,
    },
  ];
}

export default function MediationInitModal({ isOpen, onClose, item, onSubmit, isSubmitting = false }: MediationInitModalProps) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setMessage('');
    }
  }, [isOpen, item?.id]);

  if (!isOpen || !item) return null;

  const escalationReason = mediationEscalationReason(item);
  const caseSummaryLines = buildCaseSummary(item);
  const keyRows = initKeyRows(item);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    onSubmit(item.id, message.trim());
  };

  return (
    <div className="case-modal-backdrop mediation-init-backdrop" onClick={onClose}>
      <div className="mediation-init-modal" onClick={(event) => event.stopPropagation()}>
        <form className="mediation-init-form" onSubmit={handleSubmit}>
          <div className="mediation-init-shell">
            <div className="mediation-init-top">
              <button
                className="mediation-init-back-button"
                type="button"
                onClick={onClose}
                aria-label="Volver"
                title="Volver"
              >
                <UiIcon name="arrowLeft" />
              </button>

              <div className="mediation-init-brand">
                <span className="mediation-init-brand-icon">
                  <UiIcon name="scale" />
                </span>
              </div>

              <div className="mediation-init-title">
                <span className="mediation-init-kicker">Inicializar mediación</span>
                <h2>{item.externalId}</h2>
                <p>{item.sellerName} · {item.elapsed}</p>
              </div>
            </div>

            <div className="mediation-init-grid">
              <section className="mediation-init-panel mediation-init-context-panel">
                <div className="mediation-init-panel-head">
                  <span className="mediation-init-panel-icon">
                    <UiIcon name="document" />
                  </span>
                  <h3>Contexto del caso</h3>
                </div>

                <div className="mediation-init-steps">
                  <div className="mediation-init-step">
                    <div className="mediation-init-step-marker" />
                    <div className="mediation-init-step-content">
                      <span className="mediation-init-step-kicker">¿Por qué escaló?</span>
                      <p>{escalationReason}</p>
                    </div>
                  </div>

                  <div className="mediation-init-step">
                    <div className="mediation-init-step-marker" />
                    <div className="mediation-init-step-content">
                      <span className="mediation-init-step-kicker">Resumen del caso</span>
                      <div className="mediation-init-summary">
                        <div className="mediation-init-summary-copy">
                          <p>Caso {item.externalId} asociado al pedido {item.orderId}.</p>
                          <ul>
                            {caseSummaryLines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="mediation-init-summary-art" aria-hidden="true">
                          <UiIcon name="document" />
                          <span>
                            <UiIcon name="alert" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mediation-init-panel mediation-init-info-panel">
                <h3>Información clave</h3>

                <div className="mediation-init-keys">
                  {keyRows.map((row) => (
                    <div className="mediation-init-key-row" key={row.label}>
                      <span className="mediation-init-key-icon">
                        <UiIcon name={row.icon} />
                      </span>
                      <span className="mediation-init-key-label">{row.label}</span>
                      <span className="mediation-init-key-value">{row.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mediation-init-warning">
                  <span className="mediation-init-warning-icon">
                    <UiIcon name="alert" />
                  </span>
                  <div>
                    <strong>Atención</strong>
                    <p>
                      Al inicializar la mediación se creará un registro interno y se activará el seguimiento del caso.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <section className="mediation-init-panel mediation-init-message-panel">
              <div className="mediation-init-message-head">
                <span className="mediation-init-panel-icon">
                  <UiIcon name="message" />
                </span>
                <div>
                  <span className="mediation-init-panel-kicker">Motivo de inicialización</span>
                </div>
              </div>

              <label className="message-field mediation-init-message-field">
                <span className="sr-only">Mensaje para historial</span>
                <textarea
                  name="message"
                  required
                  rows={6}
                  maxLength={2000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Escribe el contexto, solicitud al vendedor o instrucción interna..."
                />
                <span className="note-counter">{message.length}/2000</span>
              </label>
            </section>

            <div className="mediation-init-footer">
              <div className="mediation-init-footer-note">
                <UiIcon name="info" />
                <p>
                  Al continuar, el caso pasará a mediación y el equipo podrá intervenir entre comprador y vendedor.
                </p>
              </div>

              <div className="modal-actions mediation-init-actions">
                <button className="secondary-button" type="button" onClick={onClose}>
                  Cancelar
                </button>
                <button className="primary-button" type="submit" disabled={!message.trim() || isSubmitting}>
                  <UiIcon name="scale" /> {isSubmitting ? 'Inicializando...' : 'Inicializar mediación'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
