import MetricCard from '@/components/shared/MetricCard';

interface SellerMetricGridProps {
  activeSellers: number;
  activeMediations: number;
  receivedReports: number;
}

export default function SellerMetricGrid({ activeSellers, activeMediations, receivedReports }: SellerMetricGridProps) {
  return (
    <section className="metric-grid compact seller-metric-grid">
      <MetricCard
        label="Vendedores activos"
        value={activeSellers}
        tone="green"
        iconName="users"
        description="Solo vendedores aprobados y visibles en el menú de vendedores."
      />
      <MetricCard
        label="Con mediación activa"
        value={activeMediations}
        tone="violet"
        iconName="scale"
        description="Mediaciones en curso asociadas a vendedores activos."
      />
      <MetricCard
        label="Reportes"
        value={receivedReports}
        tone="red"
        iconName="flag"
        description="Reportes registrados contra vendedores activos."
      />
    </section>
  );
}
