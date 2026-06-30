import SellerDetailCard from './SellerDetailCard';
import RisksSummary from './RisksSummary';
import MediationsSummary from './MediationsSummary';
import type { SellerResponse } from '@/types/seller';
import type { ImpactMediation, RiskCase } from '@/types/cases';

interface SellerExpandedRowProps {
  seller: SellerResponse;
  risks?: RiskCase[];
  mediations?: ImpactMediation[];
  blockedMediations?: ImpactMediation[];
  onViewDocs?: (id: number) => void;
  onOpenMediation?: (id: number) => void;
  onReviewMediation?: (mediationId: number) => void;
  onShowBlockHistory?: (id: number) => void;
}

export default function SellerExpandedRow({
  seller,
  risks = [],
  mediations = [],
  blockedMediations = [],
  onViewDocs,
  onOpenMediation,
  onReviewMediation,
  onShowBlockHistory,
}: SellerExpandedRowProps) {
  return (
    <tr className="seller-expanded-row">
      <td colSpan={8}>
        <div className="seller-drawer">
          <SellerDetailCard
            seller={seller}
            activeMediationCount={mediations.length}
            activeMediation={mediations[0]}
            waitingSellerCount={risks.length}
            blockedMediation={blockedMediations[0]}
            onViewDocs={onViewDocs}
            onOpenMediation={onOpenMediation}
            onShowBlockHistory={onShowBlockHistory}
          />
          <div className="seller-summary-grid">
            <RisksSummary risks={risks} />
            <MediationsSummary
              sellerId={seller.id}
              mediations={mediations}
              onReviewMediation={onReviewMediation}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}
