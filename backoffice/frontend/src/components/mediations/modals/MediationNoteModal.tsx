import { useState, useEffect } from 'react';
import { MediationDetailResponse } from '@/types/mediation';
import UiIcon from '@/components/shared/UiIcon';
import Badge from '@/components/shared/Badge';
import { mediationNoteTypeOptions, type MediationNoteType } from '@/utils/mediationNotes';
import { mediationStatusDisplay } from '@/utils/formatters';

interface MediationNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediationDetailResponse | null;
  editingNote?: { index: number; messageId: number; text: string; noteType?: MediationNoteType } | null;
  onSubmit: (id: number, note: string, noteType: MediationNoteType, noteIndex?: number) => void;
}

export default function MediationNoteModal({ isOpen, onClose, item, editingNote, onSubmit }: MediationNoteModalProps) {
  const [note, setNote] = useState('');
  const [noteType, setNoteType] = useState<MediationNoteType>('seguimiento');
  const isEditing = Boolean(editingNote);
  const counterValue = `${note.length}/1000`;

  useEffect(() => {
    if (editingNote) {
      setNote(editingNote.text);
      setNoteType(editingNote.noteType ?? 'seguimiento');
    } else {
      setNote('');
      setNoteType('seguimiento');
    }
  }, [editingNote]);

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    onSubmit(item.id, note, noteType, editingNote?.index);
    setNote('');
  };

  return (
    <div className="case-modal-backdrop mediation-note-backdrop" onClick={onClose}>
      <div className="mediation-note-modal" onClick={(event) => event.stopPropagation()}>
        <form className="mediation-note-shell" onSubmit={handleSubmit}>
          <div className="mediation-note-header">
            <div className="mediation-note-heading">
              <span className="mediation-note-icon">
                <UiIcon name="note" />
              </span>
              <div className="mediation-note-title">
                <h2>{isEditing ? 'Editar nota interna' : 'Dejar nota interna'}</h2>
                <p>{item.externalId}</p>
              </div>
            </div>

            <button className="mediation-note-close" type="button" onClick={onClose} aria-label="Cerrar">
              <UiIcon name="close" />
            </button>
          </div>

          <section className="mediation-note-intro">
            <div>
              <span className="mediation-note-kicker">Caso</span>
              <h3>{item.externalId}</h3>
              <p>{item.sellerName} · {item.reason}</p>
            </div>
            <Badge text="Solo equipo interno" variant="violet" />
          </section>

          <section className="mediation-note-strip">
            <div className="mediation-note-strip-item">
              <span className="mediation-note-strip-label">Estado</span>
              <strong>{mediationStatusDisplay(item.status, item.accountBlocked)}</strong>
            </div>
            <div className="mediation-note-strip-item">
              <span className="mediation-note-strip-label">Pedido</span>
              <strong>{item.orderId}</strong>
            </div>
            <div className="mediation-note-strip-item">
              <span className="mediation-note-strip-label">Responsable</span>
              <strong>{item.owner}</strong>
            </div>
            <div className="mediation-note-strip-item">
              <span className="mediation-note-strip-label">Tiempo transcurrido</span>
              <strong>{item.elapsed}</strong>
            </div>
          </section>

          <section className="mediation-note-grid">
            <div className="mediation-note-panel mediation-note-editor">
              <div className="mediation-note-editor-head">
                <div>
                  <h3>Nota interna</h3>
                  <p>Esta nota quedará guardada solo en el historial interno del caso.</p>
                </div>
                <span className="note-counter">{counterValue}</span>
              </div>

              <label className="mediation-note-textarea-wrap">
                <span className="sr-only">Nota interna</span>
                <textarea
                  name="note"
                  required
                  rows={7}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Escribe aquí tu nota interna..."
                />
              </label>

              <div className="mediation-note-type-group">
                <span className="mediation-note-type-label">Tipo de nota (opcional)</span>
                <div className="mediation-note-type-options" role="radiogroup" aria-label="Tipo de nota">
                  {mediationNoteTypeOptions.map((option) => {
                    const selected = noteType === option.value;
                    return (
                      <button
                        key={option.value}
                        className={`mediation-note-type-option ${selected ? 'selected' : ''} ${option.tone}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setNoteType(option.value)}
                      >
                        <UiIcon name={option.icon} />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <aside className="mediation-note-panel mediation-note-context">
              <h3>Contexto del caso</h3>
              <div className="mediation-note-context-list">
                <div className="mediation-note-context-item">
                  <span className="mediation-note-context-icon violet">
                    <UiIcon name="info" />
                  </span>
                  <p>Este caso está esperando respuesta del vendedor sobre compatibilidad de repuesto.</p>
                </div>
                <div className="mediation-note-context-item">
                  <span className="mediation-note-context-icon blue">
                    <UiIcon name="message" />
                  </span>
                  <p>La nota quedará registrada solo en el historial interno del caso y no será visible para comprador ni vendedor.</p>
                </div>
              </div>

              <div className="mediation-note-context-divider" />

              <h3>Actividad interna</h3>
              <div className="mediation-note-activity">
                <div className="mediation-note-activity-item">
                  <span className="mediation-note-activity-dot blue" />
                  <div>
                    <strong>Caso creado</strong>
                    <span>{item.createdAt}</span>
                  </div>
                </div>
                <div className="mediation-note-activity-item">
                  <span className="mediation-note-activity-dot violet" />
                  <div>
                    <strong>Esperando vendedor</strong>
                    <span>{item.updatedAt}</span>
                  </div>
                </div>
                <div className="mediation-note-activity-item">
                  <span className="mediation-note-activity-dot green" />
                  <div>
                    <strong>Última actualización</strong>
                    <span>{item.updatedAt}</span>
                  </div>
                </div>
              </div>
            </aside>
          </section>

          <footer className="mediation-note-footer">
            <div className="mediation-note-footer-copy">
              <UiIcon name="lock" />
              <p>La nota se agregará al historial interno del caso.</p>
            </div>

            <div className="modal-actions mediation-note-actions">
              <button className="secondary-button" type="button" onClick={onClose}>
                Cancelar
              </button>
              <button className="primary-button" type="submit" disabled={!note.trim()}>
                <UiIcon name="note" /> {isEditing ? 'Guardar cambios' : 'Guardar nota'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
