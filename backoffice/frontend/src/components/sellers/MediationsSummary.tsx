import UiIcon from '@/components/shared/UiIcon';
import type { ImpactMediation } from '@/types/cases';
import SellerCaseSummaryCard from './SellerCaseSummaryCard';

interface MediationsSummaryProps {
  sellerId: number;
  mediations: ImpactMediation[];
  onReviewMediation?: (mediationId: number) => void;
}

export default function MediationsSummary({ mediations, onReviewMediation }: MediationsSummaryProps) {
  const activeMediations = mediations.filter((med) => !med.accountBlocked);

  return (
    <section className="summary-card">
      <div className="summary-card-header">
        <span className="status-icon violet">
          <UiIcon name="scale" />
        </span>
        <div>
          <h3>En mediación</h3>
          <p>Casos con mediación formal ya iniciada</p>
        </div>
        <strong>{activeMediations.length}</strong>
      </div>
      <div className="insight-body">
        {activeMediations.length ? (
          activeMediations.map((med) => (
            <SellerCaseSummaryCard
              key={med.id}
              tone="violet"
              icon="scale"
              status={med.status}
              summary={med.reason}
              orderId={med.orderId}
              reason={med.reason}
              buyer={med.buyer}
              purchase={med.purchase}
              stage={med.stage}
              owner={med.owner}
              updated={med.updated}
              amount={med.amount}
              nextAction={med.nextAction}
              onPrimaryAction={() => onReviewMediation?.(Number(med.id))}
            />
          ))
        ) : (
          <div className="empty-insight">
            <strong>Sin mediaciones activas</strong>
            <p>El vendedor no tiene conflictos abiertos. Mantener seguimiento normal.</p>
          </div>
        )}
      </div>
    </section>
  );
}
