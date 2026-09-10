import { ResolvedCaseResponse } from '@/types/mediation';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { favorLabel, resolutionOptionLabel } from '@/utils/mediationResolution';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';

/** Primera línea del texto, recortada. El texto completo se ve en el detalle del caso. */
function abbreviate(text: string | undefined | null, max: number): string {
  if (!text) return '';
  const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  return firstLine.length > max ? `${firstLine.slice(0, max).trimEnd()}…` : firstLine;
}

interface MediationResolvedTableProps {
  cases: ResolvedCaseResponse[];
  totalItems?: number;
  isLoading?: boolean;
  selectedId?: number | null;
  onSelect?: (item: ResolvedCaseResponse) => void;
  onOpenTimeline: (item: ResolvedCaseResponse) => void;
}

export default function MediationResolvedTable({
  cases,
  totalItems,
  isLoading = false,
  selectedId,
  onSelect,
  onOpenTimeline,
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
              <th>Veredicto</th>
              <th>Resuelto por</th>
              <th>Fecha resolución</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10}>
                  <span className="row-sub">Cargando trazas de mediaciones resueltas...</span>
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((item) => (
                <tr key={item.id} className={selectedId === item.id ? 'is-active' : ''} onClick={() => onSelect?.(item)}>
                  <td><strong className="blue-link">{item.externalId}</strong></td>
                  <td>{item.reason}</td>
                  <td><FounderSellerName name={item.sellerName} founder={item.sellerFounder} /></td>
                  <td>{item.orderId}</td>
                  <td className="resolved-table-summary">
                    <strong className="resolved-table-clamp" title={item.resolutionReason}>
                      {abbreviate(item.resolutionReason, 110)}
                    </strong>
                    <span>{item.buyer}</span>
                  </td>
                  <td>
                    <span className="resolved-table-clamp" title={item.resolutionReason}>
                      {abbreviate(item.resolutionReason, 160)}
                    </span>
                  </td>
                  <td className="resolved-table-summary">
                    {item.resolucionFavor ? (
                      <>
                        <strong>{favorLabel(item.resolucionFavor)}</strong>
                        <span>{resolutionOptionLabel(item.resolucionOpcion)}</span>
                        {item.porcentajeReembolso ? (
                          <span>
                            Reembolso {item.porcentajeReembolso}%
                            {item.montoReembolso ? ` · ${formatCurrency(item.montoReembolso)}` : ''}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td>{item.resolvedBy || 'Mediador'}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                    <div className="seller-actions compact-actions">
                      <button
                        className="row-action"
                        type="button"
                        onClick={() => onOpenTimeline(item)}
                        aria-label="Ver historial del caso"
                        title="Ver historial del caso"
                      >
                        <UiIcon name="clock" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10}>
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
