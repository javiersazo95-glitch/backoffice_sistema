import { useEffect, useMemo, useState } from 'react';
import type { MediationDetailResponse } from '@/types/mediation';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import { formatDateTime, mediationStatusDisplay } from '@/utils/formatters';
import { useQuery } from '@tanstack/react-query';
import { getReports } from '@/api/reports';

interface UnifiedHistoryEntry {
  id: string;
  type: 'note' | 'report';
  date: string;
  title: string;
  text: string;
  author: string;
  noteType?: string;
  originalIndex?: number;
  reporterType?: string;
  category?: string;
  externalId?: string;
  source?: string;
  reportedParty: 'COMPRADOR' | 'VENDEDOR';
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

export default function MediationNotesHistoryModal(props: MediationNotesHistoryModalProps) {
  const { isOpen, onClose, item } = props;
  const [search, setSearch] = useState('');
  const [reportsFilter, setReportsFilter] = useState<'all' | 'seller' | 'buyer'>('all');

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setReportsFilter('all');
    }
  }, [isOpen]);

  const { data: allReportsData } = useQuery({
    queryKey: ['all-reports-for-mediation'],
    queryFn: () => getReports({ size: 1000 }),
    enabled: !!item && isOpen,
  });

  const buyerName = useMemo(() => {
    if (!item) return 'Comprador';
    return item.buyer || item.title.replace('Comprador vs ', '') || 'Comprador';
  }, [item]);

  const sellerName = useMemo(() => {
    return item?.sellerName || 'Tienda';
  }, [item]);

  const unifiedEntries = useMemo<UnifiedHistoryEntry[]>(() => {
    if (!item) return [];
    const formatSellerName = (name: string) => {
      const trimmed = name.trim();
      if (trimmed.toLowerCase().startsWith('tienda')) return trimmed;
      return `tienda ${trimmed}`;
    };
    
    // 1. Filter actual reports where the reported party is this seller or this buyer
    const filteredReports = (allReportsData?.content ?? []).filter((report) => {
      // 1. Report received by the seller (reported is the seller)
      const reportedIsSeller = report.reportadoType === 'VENDEDOR' && (
        String(report.reportadoId) === String(item.sellerId) || 
        report.reportadoName?.trim().toLowerCase() === sellerName.trim().toLowerCase() ||
        sellerName.trim().toLowerCase().includes(report.reportadoName?.trim().toLowerCase() ?? '') ||
        report.reportadoName?.trim().toLowerCase().includes(sellerName.trim().toLowerCase() ?? '')
      );

      // 2. Report received by the buyer (reported is the buyer)
      const reportedIsBuyer = report.reportadoType === 'COMPRADOR' && (
        report.reportadoName?.trim().toLowerCase() === buyerName.trim().toLowerCase() ||
        buyerName.trim().toLowerCase().includes(report.reportadoName?.trim().toLowerCase() ?? '') ||
        report.reportadoName?.trim().toLowerCase().includes(buyerName.trim().toLowerCase())
      );

      return reportedIsSeller || reportedIsBuyer;
    });

    // 2. Map actual reports (from BO_reportes)
    const reportEntries: UnifiedHistoryEntry[] = filteredReports.map((report) => {
      const reportedParty = report.reportadoType;
      const reporterName = report.reportanteName || (report.reportanteType === 'COMPRADOR' ? buyerName : sellerName);
      const title = reportedParty === 'VENDEDOR'
        ? `${reporterName} hizo un reporte a ${formatSellerName(sellerName)}`
        : `${formatSellerName(reporterName)} hizo un reporte a ${buyerName}`;

      const isTicket = report.idExterno?.startsWith('TCK-');

      return {
        id: `actual-report-${report.id}`,
        type: 'report',
        date: report.fechaCreacion,
        title,
        text: `Motivo: ${report.motivo}\nDetalle: ${report.descripcion}`,
        author: reporterName,
        reporterType: report.reportanteType,
        externalId: report.idExterno,
        source: isTicket ? 'Canal de Ayuda' : 'Reporte de Usuario',
        reportedParty,
      };
    });

    // 3. Sort descending by date (most recent first)
    return reportEntries.sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
    );
  }, [item, allReportsData, buyerName, sellerName]);

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return unifiedEntries.filter((entry) => {
      const matchesSearch = !query || `${entry.text} ${entry.author} ${entry.title}`.toLowerCase().includes(query);
      const matchesFilter = reportsFilter === 'all' || 
        (reportsFilter === 'seller' && entry.reportedParty === 'VENDEDOR') ||
        (reportsFilter === 'buyer' && entry.reportedParty === 'COMPRADOR');
      return matchesSearch && matchesFilter;
    });
  }, [unifiedEntries, search, reportsFilter]);

  if (!isOpen || !item) return null;

  const latestReport = unifiedEntries[0];
  const reportsToSellerCount = unifiedEntries.filter(
    (entry) => entry.reportedParty === 'VENDEDOR'
  ).length;
  const reportsToBuyerCount = unifiedEntries.filter(
    (entry) => entry.reportedParty === 'COMPRADOR'
  ).length;

  return (
    <div className="case-modal-backdrop notes-history-backdrop" onClick={onClose}>
      <div className="notes-history-shell" onClick={(event) => event.stopPropagation()}>
        <header className="notes-history-header">
          <div className="notes-history-heading">
            <span className="notes-history-heading-icon">
              <UiIcon name="document" />
            </span>
            <h2>Historial de reportes</h2>
          </div>
          <button className="notes-history-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
          </button>
        </header>

        <section className="notes-history-intro">
          <h3>{item.externalId}</h3>
          <p><FounderSellerName name={item.sellerName} founder={item.sellerFounder} /> · {item.reason}</p>
          <span className="notes-history-private-pill">
            <UiIcon name="lock" /> Solo equipo de mediación
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
            <div className="notes-history-filters" role="tablist" aria-label="Filtrar reportes" style={{ marginBottom: '14px' }}>
              <button className={reportsFilter === 'all' ? 'active' : ''} type="button" onClick={() => setReportsFilter('all')}>
                Todos
              </button>
              <button className={`${reportsFilter === 'seller' ? 'active blue' : ''}`} type="button" onClick={() => setReportsFilter('seller')}>
                <UiIcon name="users" />
                Al Vendedor
              </button>
              <button className={`${reportsFilter === 'buyer' ? 'active orange' : ''}`} type="button" onClick={() => setReportsFilter('buyer')}>
                <UiIcon name="user" />
                Al Comprador
              </button>
            </div>

            <label className="notes-history-search" style={{ marginTop: 0 }}>
              <UiIcon name="search" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar reportes..."
              />
            </label>

            <div className="notes-history-timeline">
              {visibleEntries.length ? visibleEntries.map((entry) => {
                const tone = entry.reportedParty === 'COMPRADOR' ? 'orange' : 'blue';
                const icon = entry.reportedParty === 'COMPRADOR' ? 'user' : 'users';
                return (
                  <article className={`notes-history-entry ${tone}`} key={entry.id}>
                    <span className="notes-history-entry-dot" />
                    <span className={`notes-history-entry-icon ${tone}`}>
                      <UiIcon name={icon} />
                    </span>
                    <div className="notes-history-entry-card report-card" style={{ borderLeft: `3px solid var(--${tone})` }}>
                      <div className="notes-history-entry-main">
                        <span className={`notes-history-type-badge ${tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <UiIcon name={icon} /> {entry.reportedParty === 'COMPRADOR' ? 'Reporte al Comprador' : 'Reporte al Vendedor'}
                        </span>
                        <p style={{ marginTop: '6px', fontWeight: 650, fontSize: '14px', color: '#1e293b' }}>
                          {entry.title}
                        </p>
                        <p style={{ whiteSpace: 'pre-line', marginTop: '4px', color: '#475569' }}>{entry.text}</p>
                        <small>Reportado por: {entry.author} · {entry.source || 'Canal de Ayuda'}</small>
                      </div>
                      <div className="notes-history-entry-side">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: tone === 'orange' ? '#9a3412' : '#0f766e', fontWeight: 600 }}>
                          <UiIcon name="info" /> {entry.reportedParty === 'COMPRADOR' ? 'Reporte al comprador' : 'Reporte al vendedor'}
                        </span>
                        <time>{noteDate(entry.date)}</time>
                      </div>
                    </div>
                  </article>
                );
              }) : (
                <div className="notes-history-empty">
                  <UiIcon name="document" />
                  <p>No hay reportes que coincidan con los criterios de búsqueda.</p>
                </div>
              )}
            </div>
          </main>

          <aside className="notes-history-summary">
            <h3>Resumen</h3>
            <div className="notes-history-summary-row">
              <span className="violet"><UiIcon name="clock" /></span>
              <div><small>Último reporte</small><strong>{latestReport ? noteDate(latestReport.date) : 'Sin reportes'}</strong></div>
            </div>
            <div className="notes-history-summary-row">
              <span className="blue"><UiIcon name="document" /></span>
              <div><small>Total de reportes</small><strong>{unifiedEntries.length}</strong></div>
            </div>
            <div className="notes-history-summary-row">
              <span className="orange"><UiIcon name="alert" /></span>
              <div><small>Reportes al vendedor</small><strong>{reportsToSellerCount}</strong></div>
            </div>
            <div className="notes-history-summary-row">
              <span className="violet"><UiIcon name="users" /></span>
              <div><small>Reportes al comprador</small><strong>{reportsToBuyerCount}</strong></div>
            </div>

            <div className="notes-history-summary-divider" />
            <h3>Actividad del caso</h3>
            <div className="notes-history-case-activity">
              <div><span className="blue" /><p><strong>Caso creado</strong><small>{noteDate(item.createdAt)}</small></p></div>
              <div><span className="violet" /><p><strong>{mediationStatusDisplay(item.status, item.accountBlocked)}</strong><small>{noteDate(item.updatedAt)}</small></p></div>
              {latestReport && <div><span className="orange" /><p><strong>Último reporte registrado</strong><small>{noteDate(latestReport.date)}</small></p></div>}
              <div><span className="blue" /><p><strong>Última actualización</strong><small>{noteDate(item.updatedAt)}</small></p></div>
            </div>
          </aside>
        </div>

        <footer className="notes-history-footer">
          <div><UiIcon name="lock" /><p>Los reportes son visibles solo para el equipo de mediación.</p></div>
          <div className="notes-history-footer-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cerrar</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
