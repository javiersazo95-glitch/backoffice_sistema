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
import { useQuery } from '@tanstack/react-query';
import { getTickets } from '@/api/support';

type NoteFilter = 'all' | MediationNoteType;

interface IndexedNote {
  message: MediationMessageResponse;
  originalIndex: number;
}

interface UnifiedHistoryEntry {
  id: string;
  type: 'note' | 'report';
  date: string;
  title: string;
  text: string;
  author: string;
  noteType?: MediationNoteType;
  originalIndex?: number;
  reporterType?: string;
  category?: string;
  externalId?: string;
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

  const { data: ticketsData } = useQuery({
    queryKey: ['support-tickets-for-mediation', item?.id],
    queryFn: () => getTickets({ page: 0, size: 500 }),
    enabled: !!item && isOpen,
  });

  const relatedTickets = useMemo(() => {
    if (!item || !ticketsData?.content) return [];
    return ticketsData.content.filter((ticket) => {
      // Must correspond to buyer or seller (store) of the mediation
      const matchesOrder = !!(ticket.orderId && ticket.orderId === item.orderId);
      const matchesSeller = !!(ticket.sellerId && ticket.sellerId === item.sellerId);
      
      return (matchesOrder || matchesSeller) && 
             (ticket.reporterType === 'COMPRADOR' || ticket.reporterType === 'VENDEDOR');
    });
  }, [ticketsData, item]);

  const indexedNotes = useMemo<IndexedNote[]>(() => {
    if (!item) return [];
    return (item.messages ?? [])
      .map((message, originalIndex) => ({ message, originalIndex }))
      .sort((left, right) => new Date(right.message.createdAt).getTime() - new Date(left.message.createdAt).getTime());
  }, [item]);

  const unifiedEntries = useMemo<UnifiedHistoryEntry[]>(() => {
    if (!item) return [];
    
    // 1. Map notes
    const noteEntries: UnifiedHistoryEntry[] = (item.messages ?? []).map((message, idx) => ({
      id: `note-${message.id ?? idx}`,
      type: 'note',
      date: message.createdAt,
      title: mediationNoteTypeLabel(message.noteType ?? 'seguimiento'),
      text: message.text,
      author: message.author,
      noteType: message.noteType ?? 'seguimiento',
      originalIndex: idx,
    }));

    // 2. Map reports
    const reportEntries: UnifiedHistoryEntry[] = relatedTickets.map((ticket) => {
      const reporterRoleLabel = ticket.reporterType === 'VENDEDOR' ? 'Tienda' : 'Comprador';
      return {
        id: `report-${ticket.id}`,
        type: 'report',
        date: ticket.createdAt,
        title: `Reporte de ${reporterRoleLabel}`,
        text: `Motivo: ${ticket.reason}\nDetalle: ${ticket.lastMessage || 'Sin detalles adicionales.'}`,
        author: ticket.reporterName || reporterRoleLabel,
        reporterType: ticket.reporterType,
        category: ticket.category,
        externalId: ticket.externalId,
      };
    });

    // 3. Combine and sort descending by date (most recent first)
    return [...noteEntries, ...reportEntries].sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
    );
  }, [item, relatedTickets]);

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return unifiedEntries.filter((entry) => {
      // If a specific note type filter is selected, we only show matching notes (hide reports)
      const matchesType = filter === 'all' || (entry.type === 'note' && entry.noteType === filter);
      const matchesSearch = !query || `${entry.text} ${entry.author} ${entry.title}`.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [filter, unifiedEntries, search]);

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
              {visibleEntries.length ? visibleEntries.map((entry) => {
                if (entry.type === 'note') {
                  const type = entry.noteType ?? 'seguimiento';
                  const tone = mediationNoteTypeTone(type);
                  return (
                    <article className={`notes-history-entry ${tone}`} key={entry.id}>
                      <span className="notes-history-entry-dot" />
                      <span className={`notes-history-entry-icon ${tone}`}>
                        <UiIcon name={mediationNoteTypeIcon(type)} />
                      </span>
                      <div className="notes-history-entry-card">
                        <div className="notes-history-entry-main">
                          <span className={`notes-history-type-badge ${tone}`}>{entry.title}</span>
                          <p>{entry.text}</p>
                          <small>{entry.author} · Mediación</small>
                        </div>
                        <div className="notes-history-entry-side">
                          <span><UiIcon name="lock" /> Solo equipo interno</span>
                          <time>{noteDate(entry.date)}</time>
                          <div className="notes-history-entry-actions">
                            <button type="button" onClick={() => onEditNote(item.id, entry.originalIndex!)} aria-label="Editar nota" title="Editar nota">
                              <UiIcon name="edit" />
                            </button>
                            <button type="button" onClick={() => onDeleteNote(item.id, entry.originalIndex!)} aria-label="Eliminar nota" title="Eliminar nota">
                              <UiIcon name="trash" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                } else {
                  // It's a support report (ticket)
                  const tone = entry.reporterType === 'VENDEDOR' ? 'orange' : 'blue';
                  const icon = entry.reporterType === 'VENDEDOR' ? 'alert' : 'document';
                  return (
                    <article className={`notes-history-entry ${tone}`} key={entry.id}>
                      <span className="notes-history-entry-dot" />
                      <span className={`notes-history-entry-icon ${tone}`}>
                        <UiIcon name={icon} />
                      </span>
                      <div className="notes-history-entry-card report-card" style={{ borderLeft: `3px solid var(--${tone})` }}>
                        <div className="notes-history-entry-main">
                          <span className={`notes-history-type-badge ${tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <UiIcon name={icon} /> {entry.title}
                          </span>
                          <p style={{ whiteSpace: 'pre-line', marginTop: '6px', fontWeight: 550 }}>{entry.text}</p>
                          <small>Reportado por: {entry.author} · Canal de Ayuda</small>
                        </div>
                        <div className="notes-history-entry-side">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0f766e', fontWeight: 600 }}>
                            <UiIcon name="info" /> Reporte de Cliente
                          </span>
                          <time>{noteDate(entry.date)}</time>
                        </div>
                      </div>
                    </article>
                  );
                }
              }) : (
                <div className="notes-history-empty">
                  <UiIcon name="note" />
                  <p>No hay notas ni reportes que coincidan con los filtros seleccionados.</p>
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
              <span className="orange"><UiIcon name="alert" /></span>
              <div><small>Total de reportes</small><strong>{relatedTickets.length}</strong></div>
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
              {relatedTickets.length > 0 && relatedTickets[0] && <div><span className="orange" /><p><strong>Reporte registrado</strong><small>{noteDate(relatedTickets[0].createdAt)}</small></p></div>}
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
