import { useState } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import CaseCard from '@/components/shared/CaseCard';
import type { ImpactMediation } from '@/types/cases';

interface ImpactMediationsPanelProps {
  mediations: ImpactMediation[];
  onOpenSeller?: (sellerId: number) => void;
  onOpenCase?: (caseId: string) => void;
}

const PAGE_SIZE = 5;

export default function ImpactMediationsPanel({ mediations, onOpenSeller, onOpenCase }: ImpactMediationsPanelProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const filteredMediations = mediations.filter((med) => {
    const query = search.toLowerCase();
    return (
      med.id.toLowerCase().includes(query) ||
      med.seller.toLowerCase().includes(query) ||
      med.reason.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredMediations.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleMediations = filteredMediations.slice(start, start + PAGE_SIZE);

  const from = filteredMediations.length ? start + 1 : 0;
  const to = Math.min(currentPage * PAGE_SIZE, filteredMediations.length);

  return (
    <article className="panel">
      <div className="panel-header signal-panel-header">
        <div>
          <h2>En mediación</h2>
          <span className="panel-hint">Casos formalizados que siguen abiertos</span>
        </div>
        <input
          className="input compact-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar caso o vendedor..."
        />
      </div>
      <div className="panel-body seller-signal-list">
        {visibleMediations.length ? (
          visibleMediations.map((med) => (
            <CaseCard
              key={med.id}
              id={med.id}
              sellerId={med.sellerId}
              seller={med.seller}
              status={med.status}
              reason={med.reason}
              orderId={med.orderId}
              type="impact"
              amount={med.amount}
              updated={med.updated}
              owner={med.owner}
              stage={med.stage}
              purchase={med.purchase}
              buyer={med.buyer}
              nextAction={med.nextAction}
              onOpenSeller={onOpenSeller}
              onOpenCase={onOpenCase}
            />
          ))
        ) : (
          <div className="empty-insight">
            <strong>Sin mediaciones</strong>
            <p>No hay casos en estado En mediación que coincidan con la busqueda.</p>
          </div>
        )}
      </div>
      {filteredMediations.length > 0 && (
        <div className="pagination compact-pagination">
          <span>Mostrando {from} a {to} de {filteredMediations.length} mediaciones</span>
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
