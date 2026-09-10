import { useState } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import CaseCard from '@/components/shared/CaseCard';
import type { ReportResponse } from '@/types/report';

interface ReportsPanelProps {
  reports: ReportResponse[];
}

const PAGE_SIZE = 5;

export default function ReportsPanel({ reports }: ReportsPanelProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');

  const filteredReports = reports.filter((report) => {
    const query = search.toLowerCase();
    return [report.idExterno, report.reportadoName, report.reportanteName, report.motivo, report.descripcion]
      .some((value) => value?.toLowerCase().includes(query));
  });
  const sortedReports = [...filteredReports].sort((a, b) => {
    const dateA = new Date(a.fechaCreacion).getTime();
    const dateB = new Date(b.fechaCreacion).getTime();
    return order === 'newest' ? dateB - dateA : dateA - dateB;
  });
  const totalPages = Math.max(1, Math.ceil(sortedReports.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleReports = sortedReports.slice(start, start + PAGE_SIZE);
  const from = sortedReports.length ? start + 1 : 0;
  const to = Math.min(currentPage * PAGE_SIZE, sortedReports.length);

  return (
    <article className="panel emphasis-panel">
      <div className="panel-header signal-panel-header">
        <div>
          <h2>Reportes</h2>
          <span className="panel-hint">Reportes registrados contra vendedores</span>
        </div>
        <div className="risk-panel-controls">
          <input className="input compact-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar reporte..." />
          <button className="secondary-button sort-toggle" type="button" onClick={() => setOrder(order === 'newest' ? 'oldest' : 'newest')} title="Ordenar por fecha">
            <UiIcon name="sort" />
            <span>{order === 'newest' ? 'Mas recientes' : 'Mas antiguos'}</span>
          </button>
        </div>
      </div>
      <div className="panel-body seller-signal-list">
        {visibleReports.length ? visibleReports.map((report) => (
          <CaseCard
            key={report.id}
            id={String(report.id)}
            sellerId={report.reportadoId}
            seller={report.reportadoName}
            status={report.reportanteType === 'VENDEDOR' ? 'Reporta tienda' : 'Reporta comprador'}
            statusVariant="red"
            reason={report.motivo}
            orderId={report.idExterno || `#${report.id}`}
            type="report"
            referenceLabel="Reporte"
            buyer={report.reportanteName}
            participantLabel="Reportante"
            stage={report.objetoTitulo || report.tipoObjeto}
            stageLabel="Objeto reportado"
            updated={report.fechaCreacion}
            nextAction={report.descripcion || 'Sin descripción registrada'}
          />
        )) : (
          <div className="empty-insight"><strong>Sin reportes</strong><p>No hay reportes registrados contra vendedores que coincidan con la búsqueda.</p></div>
        )}
      </div>
      {sortedReports.length > 0 && (
        <div className="pagination compact-pagination">
          <span>Mostrando {from} a {to} de {sortedReports.length} reportes</span>
          <div className="page-buttons">
            <button className="page-button page-prev" type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Pagina anterior"><UiIcon name="arrowRight" /></button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => <button key={item} className={`page-button ${item === currentPage ? 'active' : ''}`} type="button" onClick={() => setPage(item)}>{item}</button>)}
            <button className="page-button" type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Pagina siguiente"><UiIcon name="arrowRight" /></button>
          </div>
        </div>
      )}
    </article>
  );
}
