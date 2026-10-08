import { type SellerResponse, type SellerCancellationRate } from '@/types/seller';
import type { ImpactMediation } from '@/types/cases';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import { SellerExpandedContent } from './SellerExpandedRow';
import { getSellerOperationalStatus, getSellerStatusLabel, getSellerStatusTone } from './status';
import { formatDate } from '@/utils/formatters';
import { resolveProfileImageUrl } from '@/api/client';
import { RecordCard, RecordList, EmptyState, DetailSheet, CardAvatar } from '@/components/mobile';

interface SellerCardListProps {
  sellers: SellerResponse[];
  onViewSeller?: (seller: SellerResponse) => void;
  onViewDocs?: (id: number) => void;
  onReviewMediation?: (mediationId: number) => void;
  onOpenMediation?: (id: number) => void;
  onOpenReports?: (id: number) => void;
  onShowBlockHistory?: (id: number) => void;
  expandedId?: number | null;
  onToggleExpand?: (id: number) => void;
  mediations?: Record<number, ImpactMediation[]>;
  /** Cancelaciones por tienda, indexadas por `proveedorId` (= `seller.id`). */
  cancellationRates?: Record<number, SellerCancellationRate>;
  blockedMediations?: Record<number, ImpactMediation[]>;
  selectedSellerId?: number | null;
}

/** Versión móvil de SellerTable: tarjetas por tienda y detalle en hoja a pantalla completa. */
export function SellerCardList({
  sellers,
  onViewSeller,
  onViewDocs,
  onReviewMediation,
  onOpenMediation,
  onOpenReports,
  onShowBlockHistory,
  expandedId,
  onToggleExpand,
  mediations,
  blockedMediations,
  selectedSellerId,
  cancellationRates,
}: SellerCardListProps) {
  const expandedSeller = expandedId ? sellers.find((seller) => seller.id === expandedId) ?? null : null;

  return (
    <>
      <RecordList
        ariaLabel="Listado de vendedores"
        empty={<EmptyState icon="store" title="Sin vendedores" description="No hay vendedores que coincidan con la búsqueda." />}
      >
        {sellers.map((seller) => {
          const sellerMediations = mediations?.[seller.id] || [];
          // Sin ventas en la ventana la tienda no viene en el resumen: es "sin datos", no un 0%.
          const cancellation = cancellationRates?.[seller.id];
          const status = getSellerOperationalStatus(seller);
          const photo = seller.userProfileUrl ? resolveProfileImageUrl(seller.userProfileUrl) : null;
          return (
            <RecordCard
              key={seller.id}
              leading={<CardAvatar src={photo} name={seller.storeName} />}
              title={<FounderSellerName name={seller.storeName} founder={seller.founder} />}
              subtitle={`${seller.rut} · ${seller.city}`}
              badge={<Badge text={getSellerStatusLabel(status)} variant={getSellerStatusTone(status)} />}
              meta={[
                { label: 'Reportes', value: seller.pendingReceipts },
                { label: 'Mediaciones', value: sellerMediations.length },
                { label: 'Ingreso', value: seller.lastActivityAt ? formatDate(seller.lastActivityAt) : 'Sin fecha' },
                { label: 'Ventas', value: seller.salesCount ?? 0 },
                {
                  label: 'Cancela 90d',
                  value: cancellation ? `${cancellation.tasa.toFixed(1)}%${cancellation.superaUmbral ? ' ⚠' : ''}` : 'Sin ventas',
                },
              ]}
              selected={selectedSellerId === seller.id || expandedId === seller.id}
              onPress={() => onToggleExpand?.(seller.id)}
              ariaLabel={`Vendedor ${seller.storeName}`}
              actions={(
                <>
                  <button type="button" className="mb-action" onClick={() => onViewSeller?.(seller)}>
                    <UiIcon name="users" />
                    Perfil
                  </button>
                  <button type="button" className="mb-action" onClick={() => onViewDocs?.(seller.id)}>
                    <UiIcon name="document" />
                    Documentos
                  </button>
                  {sellerMediations.length > 0 && (
                    <button type="button" className="mb-action mb-action--violet" onClick={() => onOpenMediation?.(seller.id)}>
                      <UiIcon name="scale" />
                      Mediación
                    </button>
                  )}
                  {seller.pendingReceipts > 0 && (
                    <button type="button" className="mb-action mb-action--danger" onClick={() => onOpenReports?.(seller.id)}>
                      <UiIcon name="flag" />
                      Reportes
                    </button>
                  )}
                </>
              )}
            />
          );
        })}
      </RecordList>

      <DetailSheet
        open={Boolean(expandedSeller)}
        onClose={() => { if (expandedSeller) onToggleExpand?.(expandedSeller.id); }}
        title={expandedSeller ? <FounderSellerName name={expandedSeller.storeName} founder={expandedSeller.founder} /> : ''}
        subtitle={expandedSeller ? `${expandedSeller.rut} · ${expandedSeller.city}` : undefined}
        id="mb-seller-detail"
        embedded
      >
        {expandedSeller && (
          <SellerExpandedContent
            seller={expandedSeller}
            mediations={mediations?.[expandedSeller.id]}
            blockedMediations={blockedMediations?.[expandedSeller.id] || []}
            onViewDocs={onViewDocs}
            onOpenMediation={onOpenMediation}
            onReviewMediation={onReviewMediation}
            onShowBlockHistory={onShowBlockHistory}
          />
        )}
      </DetailSheet>
    </>
  );
}
