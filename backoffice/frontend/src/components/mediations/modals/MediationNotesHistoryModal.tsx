import { useEffect, useMemo, useState } from 'react';
import type { MediationDetailResponse, MediationMessageResponse } from '@/types/mediation';
import UiIcon from '@/components/shared/UiIcon';
import { formatDateTime, mediationStatusDisplay } from '@/utils/formatters';
import {
  mediationNoteTypeIcon,
  mediationNoteTypeLabel,
  mediationNoteTypeOptions,
  mediationNoteTypeTone,
  type MediationNoteType,
} from '@/utils/mediationNotes';

type NoteFilter = 'all' | MediationNoteType;

interface IndexedNote {
  message: MediationMessageResponse;
  originalIndex: number;
}

interface MediationNotesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewNote: () => void;
  item: MediationDetailResponse | null;
  onEditNote: (id: number, noteIndex: number) => void;
  onDeleteNote: (id: number, noteIndex: number) => void;
}

function noteDate(value?: string) {
  return value ? formatDateTime(value) : 'Sin fecha';
}

export default function MediationNotesHistoryModal({
  isOpen,
  onClose,
  onNewNote,
  item,
  onEditNote,
  onDeleteNote,
}: MediationNotesHistoryModalProps) {
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setFilter('all');
      setSearch('');
    }
  }, [isOpen]);

  const indexedNotes = useMemo<IndexedNote[]>(() => {
    if (!item) return [];
    return (item.messages ?? [])
      .map((message, originalIndex) => ({ message, originalIndex }))
      .sort((left, right) => new Date(right.message.createdAt).getTime() - new Date(left.message.createdAt).getTime());
  }, [item]);

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return indexedNotes.filter(({ message }) => {
      const type = message.noteType ?? 'seguimiento';
      const matchesType = filter === 'all' || type === filter;
      const matchesSearch = !query || `${message.text} ${message.author} ${mediationNoteTypeLabel(type)}`.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [filter, indexedNotes, search]);

  if (!isOpen || !item) return null;

  const registeredTypes = Array.from(new Set(indexedNotes.map(({ message }) => mediationNoteTypeLabel(message.noteType))));
  const latestNote = indexedNotes[0]?.message;

  return (
    <div className="case-modal-backdrop notes-history-backdrop" onClick={onClose}>
      <div className="notes-history-shell" onClick={(event) => event.stopPropagation()}>
        <header className="notes-history-header">
          <div className="notes-history-heading">
            <span className="notes-history-heading-icon">
              <UiIcon name="clock" />
            </span>
            <h2>Historial de notas</h2>
          </div>
          <button className="notes-history-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
          </button>
        </header>

        <section className="notes-history-intro">
          <h3>{item.externalId}</h3>
          <p>{item.sellerName} · {item.reason}</p>
          <span className="notes-history-private-pill">
            <UiIcon name="lock" /> Solo equipo interno
          </span>
        </section>

        <section className="notes-history-strip">
          <div className="notes-history-strip-item">
            <span className="notes-history-strip-icon"><UiIcon name="clock" /></span>
            <div><small>Estado</small><strong>{mediationStatusDisplay(item.status, item.accountBlocked)}</strong></div>
          </div>
          <div className="notes-history-strip-item">
            <span className="notes-history-strip-icon"><UiIcon name="clipboard" /></span>
            <div><small>Pedido</small><strong>{item.orderId}</strong></div>
          </div>
          <div className="notes-history-strip-item">
            <span className="notes-history-strip-icon"><UiIcon name="users" /></span>
            <div><small>Responsable</small><strong>{item.owner}</strong></div>
          </div>
          <div className="notes-history-strip-item">
            <span className="notes-history-strip-icon"><UiIcon name="calendar" /></span>
            <div><small>Tiempo transcurrido</small><strong>{item.elapsed}</strong></div>
          </div>
        </section>

        <div className="notes-history-content">
          <main className="notes-history-main">
            <div className="notes-history-filters" role="tablist" aria-label="Filtrar notas">
              <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>
                Todas
              </button>
              {mediationNoteTypeOptions.map((option) => (
                <button
                  className={`${filter === option.value ? 'active' : ''} ${option.tone}`}
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                >
                  <UiIcon name={option.icon} />
                  {option.label}
                </button>
              ))}
            </div>

            <label className="notes-history-search">
              <UiIcon name="search" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar en notas"
              />
            </label>

            <div className="notes-history-timeline">
              {visibleNotes.length ? visibleNotes.map(({ message, originalIndex }) => {
                const type = message.noteType ?? 'seguimiento';
                const tone = mediationNoteTypeTone(type);
                return (
                  <article className={`notes-history-entry ${tone}`} key={message.id ?? originalIndex}>
                    <span className="notes-history-entry-dot" />
                    <span className={`notes-history-entry-icon ${tone}`}>
                      <UiIcon name={mediationNoteTypeIcon(type)} />
                    </span>
                    <div className="notes-history-entry-card">
                      <div className="notes-history-entry-main">
                        <span className={`notes-history-type-badge ${tone}`}>{mediationNoteTypeLabel(type)}</span>
                        <p>{message.text}</p>
                        <small>{message.author} · Mediación</small>
                      </div>
                      <div className="notes-history-entry-side">
                        <span><UiIcon name="lock" /> Solo equipo interno</span>
                        <time>{noteDate(message.createdAt)}</time>
                        <div className="notes-history-entry-actions">
                          <button type="button" onClick={() => onEditNote(item.id, originalIndex)} aria-label="Editar nota" title="Editar nota">
                            <UiIcon name="edit" />
                          </button>
                          <button type="button" onClick={() => onDeleteNote(item.id, originalIndex)} aria-label="Eliminar nota" title="Eliminar nota">
                            <UiIcon name="trash" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }) : (
                <div className="notes-history-empty">
                  <UiIcon name="note" />
                  <p>No hay notas que coincidan con los filtros seleccionados.</p>
                </div>
              )}
            </div>
          </main>

          <aside className="notes-history-summary">
            <h3>Resumen</h3>
            <div className="notes-history-summary-row">
              <span className="violet"><UiIcon name="clock" /></span>
              <div><small>Última nota</small><strong>{latestNote ? noteDate(latestNote.createdAt) : 'Sin notas'}</strong></div>
            </div>
            <div className="notes-history-summary-row">
              <span className="blue"><UiIcon name="document" /></span>
              <div><small>Total de notas</small><strong>{indexedNotes.length}</strong></div>
            </div>
            <div className="notes-history-summary-row">
              <span className="violet"><UiIcon name="note" /></span>
              <div><small>Tipos registrados</small><strong>{registeredTypes.length ? registeredTypes.join(', ') : 'Sin tipos registrados'}</strong></div>
            </div>

            <div className="notes-history-summary-divider" />
            <h3>Actividad del caso</h3>
            <div className="notes-history-case-activity">
              <div><span className="blue" /><p><strong>Caso creado</strong><small>{noteDate(item.createdAt)}</small></p></div>
              <div><span className="violet" /><p><strong>{mediationStatusDisplay(item.status, item.accountBlocked)}</strong><small>{noteDate(item.updatedAt)}</small></p></div>
              {latestNote && <div><span className="green" /><p><strong>Nota agregada</strong><small>{noteDate(latestNote.createdAt)}</small></p></div>}
              <div><span className="blue" /><p><strong>Última actualización</strong><small>{noteDate(item.updatedAt)}</small></p></div>
            </div>
          </aside>
        </div>

        <footer className="notes-history-footer">
          <div><UiIcon name="lock" /><p>Las notas son visibles solo para el equipo interno del caso.</p></div>
          <div className="notes-history-footer-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cerrar</button>
            <button className="primary-button" type="button" onClick={onNewNote}><UiIcon name="note" /> Nueva nota</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
