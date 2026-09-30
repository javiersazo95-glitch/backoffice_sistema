import { ResolvedCaseResponse } from '@/types/mediation';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { favorLabel, resolutionOptionLabel } from '@/utils/mediationResolution';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import Badge from '@/components/shared/Badge';
import { RecordCard, RecordList, EmptyState } from '@/components/mobile';

function firstLine(text: string | undefined | null, max: number): string {
  if (!text) return '';
  const line = text.split('\n').map((part) => part.trim()).find(Boolean) ?? '';
  return line.length > max ? `${line.slice(0, max).trimEnd()}…` : line;
}

interface MediationResolvedCardListProps {
  cases: ResolvedCaseResponse[];
  totalItems?: number;
  isLoading?: boolean;
  selectedId?: number | null;
  onSelect?: (item: ResolvedCaseResponse) => void;
  onOpenTimeline: (item: ResolvedCaseResponse) => void;
}

/** Versión móvil de MediationResolvedTable. */
export function MediationResolvedCardList({
  cases,
  totalItems,
  isLoading = false,
  selectedId,
  onSelect,
  onOpenTimeline,
}: MediationResolvedCardListProps) {
  const rows = [...cases].sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0));

  return (
    <section className="mediation-data-section resolved-table-section mb-section">
      <div className="panel-header resolved-table-header">
        <div>
          <h2>Mediaciones resueltas</h2>
          <span className="panel-hint">Historial de casos cerrados con resumen operativo</span>
        </div>
        <span className="panel-count">{totalItems ?? rows.length}</span>
      </div>
      <RecordList
        loading={isLoading}
        ariaLabel="Mediaciones resueltas"
        empty={<EmptyState icon="check" title="Aún no hay casos resueltos" description="Cuando se cierre una mediación aparecerá aquí con su resumen." />}
      >
        {rows.map((item) => {
          const favor = item.resolucionFavor;
          return (
            <RecordCard
              key={item.id}
              title={item.externalId}
              subtitle={<><span>{item.buyer}</span> · <FounderSellerName name={item.sellerName} founder={item.sellerFounder} /></>}
              badge={favor ? <Badge text={favor === 'COMPRADOR' ? 'Comprador' : 'Tienda'} variant={favor === 'COMPRADOR' ? 'blue' : 'green'} /> : <Badge text="Resuelta" variant="resuelta" />}
              meta={[
                { label: 'Pedido', value: item.orderId },
                { label: 'Fecha', value: formatDateTime(item.createdAt) },
                ...(favor ? [{ label: 'Veredicto', value: favorLabel(favor) }] : []),
                ...(item.resolucionOpcion ? [{ label: 'Resolución', value: resolutionOptionLabel(item.resolucionOpcion) }] : []),
                ...(item.porcentajeReembolso
                  ? [{ label: 'Reembolso', value: `${item.porcentajeReembolso}%${item.montoReembolso ? ` · ${formatCurrency(item.montoReembolso)}` : ''}` }]
                  : []),
                { label: 'Resuelto por', value: item.resolvedBy || 'Mediador' },
                { label: 'Motivo', value: item.reason, wide: true },
              ]}
              footer={firstLine(item.resolutionReason, 160) || undefined}
              selected={selectedId === item.id}
              onPress={onSelect ? () => onSelect(item) : undefined}
              actions={(
                <button type="button" className="mb-action" onClick={() => onOpenTimeline(item)}>
                  <UiIcon name="clock" />
                  Historial del caso
                </button>
              )}
            />
          );
        })}
      </RecordList>
    </section>
  );
}
