import { MediationResponse } from '@/types/mediation';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import Badge from '@/components/shared/Badge';
import { mediationStatusDisplay } from '@/utils/formatters';
import { RecordCard, RecordList, EmptyState } from '@/components/mobile';

interface MediationCardListProps {
  mediations: MediationResponse[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onOpenMediationCase: (id: number) => void;
  onOpenReactivation: (id: number) => void;
  onOpenSellerInfo: (sellerId: number) => void;
}

function buyerLabel(item: MediationResponse): string {
  return item.buyer?.trim() || item.title.replace('Comprador vs ', '').trim() || 'Comprador';
}

/** Versión móvil de MediationTable: una tarjeta por caso, con el detalle al tocar. */
export function MediationCardList({
  mediations,
  selectedId,
  onSelect,
  onOpenMediationCase,
  onOpenReactivation,
  onOpenSellerInfo,
}: MediationCardListProps) {
  return (
    <RecordList
      ariaLabel="Mediaciones activas"
      empty={<EmptyState icon="scale" title="Sin mediaciones" description="No hay mediaciones que coincidan con la búsqueda." />}
    >
      {mediations.map((item) => {
        const canReview = item.status === 'EN_MEDIACION' && !item.accountBlocked;
        return (
          <RecordCard
            key={item.id}
            title={item.externalId}
            subtitle={<><span>{buyerLabel(item)}</span> · <FounderSellerName name={item.sellerName} founder={item.sellerFounder} /></>}
            badge={<Badge text={mediationStatusDisplay(item.status, item.accountBlocked)} variant={item.accountBlocked ? 'cuenta-bloqueada' : item.status} />}
            meta={[
              { label: 'Pedido', value: <strong className="blue-link">{item.orderId}</strong> },
              { label: 'Abierta hace', value: item.elapsed || '—' },
              { label: 'Motivo', value: item.reason, wide: true },
            ]}
            selected={selectedId === item.id}
            onPress={() => onSelect(item.id)}
            ariaLabel={`Mediación ${item.externalId}, ${buyerLabel(item)}`}
            actions={(
              <>
                <button type="button" className="mb-action" onClick={() => onOpenSellerInfo(item.sellerId)}>
                  <UiIcon name="users" />
                  Tienda
                </button>
                {canReview && (
                  <button type="button" className="mb-action mb-action--violet" onClick={() => onOpenMediationCase(item.id)}>
                    <UiIcon name="scale" />
                    Revisar mediación
                  </button>
                )}
                {item.accountBlocked && (
                  <button type="button" className="mb-action mb-action--danger" onClick={() => onOpenReactivation(item.id)}>
                    <UiIcon name="lock" />
                    Reactivar cuenta
                  </button>
                )}
              </>
            )}
          />
        );
      })}
    </RecordList>
  );
}
