import { useState } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import CaseCard from '@/components/shared/CaseCard';
import type { RiskCase } from '@/types/cases';

interface RisksPanelProps {
  risks: RiskCase[];
  onOpenSeller?: (sellerId: number) => void;
  onOpenCase?: (caseId: string) => void;
}

const RISK_PAGE_SIZE = 5;

export default function RisksPanel({ risks, onOpenSeller, onOpenCase }: RisksPanelProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');

  const filteredRisks = risks.filter((risk) => {
    const query = search.toLowerCase();
    return (
      risk.id.toLowerCase().includes(query) ||
      risk.seller.toLowerCase().includes(query) ||
      risk.reason.toLowerCase().includes(query)
    );
  });

  const sortedRisks = [...filteredRisks].sort((a, b) => {
    const dateA = new Date(a.updated).getTime();
    const dateB = new Date(b.updated).getTime();
    return order === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const totalPages = Math.max(1, Math.ceil(sortedRisks.length / RISK_PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * RISK_PAGE_SIZE;
  const visibleRisks = sortedRisks.slice(start, start + RISK_PAGE_SIZE);

  const from = sortedRisks.length ? start + 1 : 0;
  const to = Math.min(currentPage * RISK_PAGE_SIZE, sortedRisks.length);

  return (
    <article className="panel emphasis-panel">
      <div className="panel-header signal-panel-header">
        <div>
          <h2>Esperando al vendedor</h2>
          <span className="panel-hint">Casos pendientes de respuesta o gestión del vendedor</span>
        </div>
        <div className="risk-panel-controls">
          <input
            className="input compact-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar caso..."
          />
          <button
            className="secondary-button sort-toggle"
            type="button"
            onClick={() => setOrder(order === 'newest' ? 'oldest' : 'newest')}
            title="Ordenar por fecha"
          >
            <UiIcon name="sort" />
            <span>{order === 'newest' ? 'Mas recientes' : 'Mas antiguos'}</span>
          </button>
        </div>
      </div>
      <div className="panel-body seller-signal-list">
        {visibleRisks.length ? (
          visibleRisks.map((risk) => (
            <CaseCard
              key={risk.id}
              id={risk.id}
              sellerId={risk.sellerId}
              seller={risk.seller}
              status={risk.status}
              reason={risk.reason}
              orderId={risk.orderId}
              type="risk"
              updated={risk.updated}
              stage={risk.stage}
              owner={risk.owner}
              purchase={risk.purchase}
              buyer={risk.buyer}
              onOpenSeller={onOpenSeller}
              onOpenCase={onOpenCase}
            />
          ))
        ) : (
          <div className="empty-insight">
            <strong>Sin casos esperando al vendedor</strong>
            <p>No hay casos esperando al vendedor que coincidan con la busqueda.</p>
          </div>
        )}
      </div>
      {sortedRisks.length > 0 && (
        <div className="pagination compact-pagination">
          <span>Mostrando {from} a {to} de {sortedRisks.length} casos</span>
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
