import { useState, useEffect, useMemo } from 'react';
import { MediationDetailResponse } from '@/types/mediation';
import UiIcon from '@/components/shared/UiIcon';
import Badge from '@/components/shared/Badge';
import {
  mediationNoteTypeOptions,
  mediationNoteTypeIcon,
  mediationNoteTypeLabel,
  mediationNoteTypeTone,
  type MediationNoteType,
} from '@/utils/mediationNotes';
import { formatDateTime, mediationStatusDisplay } from '@/utils/formatters';

interface MediationNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediationDetailResponse | null;
  editingNote?: { index: number; messageId: number; text: string; noteType?: MediationNoteType } | null;
  onSubmit: (id: number, note: string, noteType: MediationNoteType, noteIndex?: number) => void;
  onEditNote: (index: number) => void;
  onDeleteNote: (id: number, index: number) => void;
  onCancelEdit: () => void;
}

export default function MediationNoteModal({
  isOpen,
  onClose,
  item,
  editingNote,
  onSubmit,
  onEditNote,
  onDeleteNote,
  onCancelEdit,
}: MediationNoteModalProps) {
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

  const daysElapsed = useMemo(() => {
    if (!item?.createdAt) return '0';
    const createdDate = new Date(item.createdAt);
    const currentDate = new Date();
    const diffTime = currentDate.getTime() - createdDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    return `${diffDays}`;
  }, [item?.createdAt]);

  const indexedNotes = useMemo(() => {
    if (!item) return [];
    return (item.messages ?? [])
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => message.internal || (message as any).isInternal)
      .sort((a, b) => new Date(b.message.createdAt).getTime() - new Date(a.message.createdAt).getTime());
  }, [item]);

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
                <h2>{isEditing ? 'Editar nota interna' : 'Notas internas del caso'}</h2>
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
              <span className="mediation-note-strip-label">Días transcurridos</span>
              <strong>{daysElapsed}</strong>
            </div>
          </section>

          <section className="mediation-note-grid">
            <div className="mediation-note-panel mediation-note-editor">
              <div className="mediation-note-editor-head">
                <div>
                  <h3>{isEditing ? 'Modificar nota' : 'Agregar nota interna'}</h3>
                  <p>Esta nota quedará registrada únicamente para el equipo de mediación.</p>
                </div>
                <span className="note-counter">{counterValue}</span>
              </div>

              <label className="mediation-note-textarea-wrap">
                <span className="sr-only">Nota interna</span>
                <textarea
                  name="note"
                  required
                  rows={4}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Escribe aquí tu nota interna..."
                />
              </label>

              <div className="mediation-note-type-group" style={{ marginBottom: '20px' }}>
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

            <aside className="mediation-note-panel mediation-note-context" style={{ alignSelf: 'start' }}>
              <h3>Contexto del caso</h3>
              <div className="mediation-note-context-list">
                <div className="mediation-note-context-item">
                  <span className="mediation-note-context-icon violet">
                    <UiIcon name="info" />
                  </span>
                  <p>Este caso está en etapa de mediación activa.</p>
                </div>
                <div className="mediation-note-context-item">
                  <span className="mediation-note-context-icon blue">
                    <UiIcon name="message" />
                  </span>
                  <p>Las notas quedarán registradas solo para el equipo y no serán visibles para el comprador ni el vendedor.</p>
                </div>
              </div>

              <div className="mediation-note-context-divider" />

              <h3>Actividad del caso</h3>
              <div className="mediation-note-activity">
                <div className="mediation-note-activity-item">
                  <span className="mediation-note-activity-dot blue" />
                  <div>
                    <strong>Caso creado</strong>
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                </div>
                <div className="mediation-note-activity-item">
                  <span className="mediation-note-activity-dot violet" />
                  <div>
                    <strong>Última actualización</strong>
                    <span>{formatDateTime(item.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </aside>
          </section>

          <div className="mediation-notes-list" style={{ padding: '0 24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--slate-800)', marginBottom: '12px' }}>
              Notas registradas ({indexedNotes.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
              {indexedNotes.length ? (
                indexedNotes.map(({ message: note, index }) => {
                  const noteType = note.noteType ?? 'seguimiento';
                  const tone = mediationNoteTypeTone(noteType);
                  const icon = mediationNoteTypeIcon(noteType);
                  return (
                    <article className={`mediation-note-item ${tone}`} key={note.id} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: '10px', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#f8fafc' }}>
                      <span className={`mediation-note-item-icon ${tone}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%' }}>
                        <UiIcon name={icon} />
                      </span>
                      <div className="mediation-note-item-body">
                        <div className="mediation-note-item-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '13px' }}>{mediationNoteTypeLabel(noteType)}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <time style={{ fontSize: '11px', color: '#64748b' }}>{formatDateTime(note.createdAt)}</time>
                            <button
                              type="button"
                              onClick={() => onEditNote(index)}
                              style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#64748b' }}
                              title="Editar"
                            >
                              <UiIcon name="edit" style={{ width: '14px', height: '14px' }} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteNote(item.id, index)}
                              style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#ef4444' }}
                              title="Eliminar"
                            >
                              <UiIcon name="trash" style={{ width: '14px', height: '14px' }} />
                            </button>
                          </div>
                        </div>
                        <p style={{ whiteSpace: 'pre-line', marginTop: '4px', fontSize: '13px', color: '#334155' }}>
                          {note.text}
                        </p>
                        <small style={{ display: 'block', marginTop: '6px', color: '#64748b', fontSize: '11px' }}>
                          Por: {note.author || 'Equipo interno'}
                        </small>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
                  <p style={{ fontSize: '13px' }}>No hay notas registradas en este caso.</p>
                </div>
              )}
            </div>
          </div>

          <footer className="mediation-note-footer">
            <div className="mediation-note-footer-copy">
              <UiIcon name="lock" />
              <p>Las notas son de carácter confidencial.</p>
            </div>

            <div className="modal-actions mediation-note-actions" style={{ display: 'flex', gap: '8px' }}>
              <button className="secondary-button" type="button" onClick={onClose}>
                Cerrar
              </button>
              {isEditing && (
                <button className="secondary-button" type="button" onClick={onCancelEdit}>
                  Cancelar edición
                </button>
              )}
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
