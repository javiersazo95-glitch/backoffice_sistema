import PageSizeSelector from './PageSizeSelector';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export default function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  const start = currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, totalItems);

  const pages: number[] = [];
  const maxVisible = 5;
  let startPage = Math.max(0, currentPage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages, startPage + maxVisible);
  startPage = Math.max(0, endPage - maxVisible);
  for (let i = startPage; i < endPage; i++) pages.push(i);

  if (totalPages <= 1 && totalItems <= pageSize) return null;

  return (
    <div className="pagination">
      <span>{totalItems > 0 ? `${start}–${end} de ${totalItems}` : 'Sin resultados'}</span>
      <div className="page-buttons">
        <button
          className="page-button page-prev icon-only"
          disabled={currentPage === 0}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <span className="ui-icon"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg></span>
        </button>
        {pages.map((p) => (
          <button
            key={p}
            className={`page-button${p === currentPage ? ' active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p + 1}
          </button>
        ))}
        <button
          className="page-button icon-only"
          disabled={currentPage >= totalPages - 1}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <span className="ui-icon"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg></span>
        </button>
        {onPageSizeChange && (
          <PageSizeSelector value={pageSize} onChange={onPageSizeChange} />
        )}
      </div>
    </div>
  );
}
