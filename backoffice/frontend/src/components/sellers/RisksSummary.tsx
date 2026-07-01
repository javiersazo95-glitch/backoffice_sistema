import UiIcon from '@/components/shared/UiIcon';
import type { RiskCase } from '@/types/cases';
import SellerCaseSummaryCard from './SellerCaseSummaryCard';

interface RisksSummaryProps {
  risks: RiskCase[];
}

export default function RisksSummary({ risks }: RisksSummaryProps) {
  return (
    <section className="summary-card">
      <div className="summary-card-header">
        <span className="status-icon amber">
          <UiIcon name="clock" />
        </span>
        <div>
          <h3>En disputa</h3>
          <p>Casos pendientes de respuesta</p>
        </div>
        <strong>{risks.length}</strong>
      </div>
      <div className="insight-body">
        {risks.length ? (
          risks.map((risk) => (
            <SellerCaseSummaryCard
              key={risk.id}
              tone="amber"
              icon="clock"
              status={risk.status}
              summary={risk.reason}
              orderId={risk.orderId}
              reason={risk.reason}
              buyer={risk.buyer}
              purchase={risk.purchase}
              stage={risk.stage}
              owner={risk.owner}
              updated={risk.updated}
            />
          ))
        ) : (
          <div className="empty-insight">
            <strong>Sin casos en disputa</strong>
            <p>No hay casos esperando respuesta para este vendedor.</p>
          </div>
        )}
      </div>
    </section>
  );
}
