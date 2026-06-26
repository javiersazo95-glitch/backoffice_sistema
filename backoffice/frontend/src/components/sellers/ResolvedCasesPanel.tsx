import { useState } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import CaseCard from '@/components/shared/CaseCard';
import type { ResolvedCase } from '@/types/cases';

interface ResolvedCasesPanelProps {
  cases: ResolvedCase[];
  onOpenSeller?: (sellerId: number) => void;
}

const PAGE_SIZE = 5;

export default function ResolvedCasesPanel({ cases, onOpenSeller }: ResolvedCasesPanelProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const filteredCases = cases.filter((item) => {
    const query = search.toLowerCase();
    return (
      item.caseId.toLowerCase().includes(query) ||
      item.seller.toLowerCase().includes(query) ||
      item.reason.toLowerCase().includes(query) ||
      item.kind.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleCases = filteredCases.slice(start, start + PAGE_SIZE);

  const from = filteredCases.length ? start + 1 : 0;
  const to = Math.min(currentPage * PAGE_SIZE, filteredCases.length);

  return (
    <article className="panel">
      <div className="panel-header signal-panel-header">
        <div>
          <h2>Casos resueltos</h2>
          <span className="panel-hint">Resoluciones cerradas con respaldo</span>
        </div>
        <div className="resolved-panel-controls">
          <input
            className="input compact-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar resolucion..."
          />
        </div>
      </div>
      <div className="panel-body seller-signal-list">
        {visibleCases.length ? (
          visibleCases.map((item) => (
            <CaseCard
              key={item.id}
              id={item.id}
              sellerId={item.sellerId}
              seller={item.seller}
              status="Resuelta"
              reason={item.reason}
              orderId={item.orderId}
              type="resolved"
              resolvedDate={item.resolvedDate}
              resolvedBy={item.resolvedBy}
              resolutionReason={item.resolutionReason}
              documentName={item.documentName}
              onOpenSeller={onOpenSeller}
            />
          ))
        ) : (
          <div className="empty-insight">
            <strong>Sin casos resueltos</strong>
            <p>Aún no hay resoluciones registradas para casos esperando al vendedor o mediaciones.</p>
          </div>
        )}
      </div>
      {filteredCases.length > 0 && (
        <div className="pagination compact-pagination">
          <span>Mostrando {from} a {to} de {filteredCases.length} resoluciones</span>
          <div className="page-buttons">
            <button
              className="page-button page-prev"
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Pagina anterior"
            >
              <UiIcon name="arrowRight" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`page-button ${p === currentPage ? 'active' : ''}`}
                type="button"
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="page-button"
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Pagina siguiente"
            >
              <UiIcon name="arrowRight" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
