import SellerDetailCard from './SellerDetailCard';
import MediationsSummary from './MediationsSummary';
import ReportsSummary from './ReportsSummary';
import type { SellerResponse } from '@/types/seller';
import type { ImpactMediation } from '@/types/cases';

interface SellerExpandedRowProps {
  seller: SellerResponse;
  mediations?: ImpactMediation[];
  blockedMediations?: ImpactMediation[];
  onViewDocs?: (id: number) => void;
  onOpenMediation?: (id: number) => void;
  onReviewMediation?: (mediationId: number) => void;
  onShowBlockHistory?: (id: number) => void;
}

/**
 * Contenido del detalle expandido de un vendedor (ficha + resúmenes). En escritorio vive dentro
 * de la fila expandida de la tabla; en móvil se reutiliza dentro de una hoja de detalle.
 */
export function SellerExpandedContent({
  seller,
  mediations = [],
  blockedMediations = [],
  onViewDocs,
  onOpenMediation,
  onReviewMediation,
  onShowBlockHistory,
}: SellerExpandedRowProps) {
  const latestMediation = [...mediations]
    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())[0];

  return (
    <div className="seller-drawer">
      <SellerDetailCard
        seller={seller}
        activeMediationCount={mediations.length}
        activeMediation={latestMediation}
        blockedMediation={blockedMediations[0]}
        onViewDocs={onViewDocs}
        onOpenMediation={onOpenMediation}
        onShowBlockHistory={onShowBlockHistory}
      />
      <div className={`seller-summary-grid ${seller.pendingReceipts > 0 ? '' : 'seller-summary-grid--single'}`}>
        {seller.pendingReceipts > 0 && (
          <ReportsSummary sellerId={seller.id} reportCount={seller.pendingReceipts} />
        )}
        <MediationsSummary
          sellerId={seller.id}
          mediations={mediations}
          onReviewMediation={onReviewMediation}
        />
      </div>
    </div>
  );
}

export default function SellerExpandedRow(props: SellerExpandedRowProps) {
  return (
    <tr className="seller-expanded-row">
      <td colSpan={9}>
        <SellerExpandedContent {...props} />
      </td>
    </tr>
  );
}
