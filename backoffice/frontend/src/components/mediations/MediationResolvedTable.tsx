import { ResolvedCaseResponse } from '@/types/mediation';
import { formatDateTime } from '@/utils/formatters';
import UiIcon from '@/components/shared/UiIcon';

const getDisplayResponsible = (resolvedBy?: string, owner?: string) => {
  const val = (resolvedBy || owner || '').trim();
  if (!val || val === 'Sistema' || val === 'No asignado') {
    return 'Mediador';
  }
  if (val === 'Comprador/Vendedor') {
    return 'Vendedor';
  }
  const lower = val.toLowerCase();
  if (lower.includes('comprador')) return 'Comprador';
  if (lower.includes('vendedor')) return 'Vendedor';
  if (lower.includes('mediador') || lower.includes('admin') || lower.includes('sistema')) return 'Mediador';
  return 'Mediador';
};

interface MediationResolvedTableProps {
  cases: ResolvedCaseResponse[];
  totalItems?: number;
  isLoading?: boolean;
  onOpenResolvedDoc: (id: number) => void;
  onOpenResolvedSummary: (id: number) => void;
}

export default function MediationResolvedTable({
  cases,
  totalItems,
  isLoading = false,
  onOpenResolvedDoc,
  onOpenResolvedSummary,
}: MediationResolvedTableProps) {
  const rows = [...cases].sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0));

  return (
    <section className="mediation-data-section resolved-table-section">
      <div className="panel-header resolved-table-header">
        <div>
          <h2>Mediaciones resueltas</h2>
          <span className="panel-hint">Registro histórico de casos resueltos con documento adjunto y resumen operativo</span>
        </div>
        <span className="panel-count">{totalItems ?? rows.length}</span>
      </div>
      <div className="table-wrap">
        <table className="wide-table">
          <thead>
            <tr>
              <th>Registro</th>
              <th>Motivo</th>
              <th>Tienda</th>
              <th>Pedido</th>
              <th>Resumen</th>
              <th>Resolución</th>
              <th>Resuelto por</th>
              <th>Fecha resolución</th>
              <th>Iconos</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9}>
                  <span className="row-sub">Cargando trazas de mediaciones resueltas...</span>
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((item) => (
                <tr key={item.id}>
                  <td><strong className="blue-link">{item.externalId}</strong></td>
                  <td>{item.reason}</td>
                  <td>{item.sellerName}</td>
                  <td>{item.orderId}</td>
                  <td className="resolved-table-summary">
                    <strong>{item.resolutionReason}</strong>
                    <span>{item.buyer}</span>
                  </td>
                  <td>{item.resolutionReason}</td>
                  <td>{getDisplayResponsible(item.resolvedBy, (item as any).owner)}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                    <div className="seller-actions compact-actions">
                      <button
                        className="row-action"
                        type="button"
                        onClick={() => onOpenResolvedDoc(item.id)}
                        aria-label="Ver documento adjunto"
                        title="Ver documento adjunto"
                      >
                        <UiIcon name="fileCheck" />
                      </button>
                      <button
                        className="row-action"
                        type="button"
                        onClick={() => onOpenResolvedSummary(item.id)}
                        aria-label="Ver resumen del caso"
                        title="Ver resumen del caso"
                      >
                        <UiIcon name="audit" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9}>
                  <span className="row-sub">Aún no hay mediaciones resueltas para mostrar en la traza.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
