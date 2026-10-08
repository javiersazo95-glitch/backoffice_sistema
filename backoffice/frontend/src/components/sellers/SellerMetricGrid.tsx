import MetricCard from '@/components/shared/MetricCard';

interface SellerMetricGridProps {
  activeSellers: number;
  activeMediations: number;
  receivedReports: number;
  highCancellation: number;
}

export default function SellerMetricGrid({ activeSellers, activeMediations, receivedReports, highCancellation }: SellerMetricGridProps) {
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
      <MetricCard
        label="Cancelan demasiado"
        value={highCancellation}
        tone="amber"
        iconName="alert"
        description="Tiendas sobre el umbral de ventas canceladas por ellas mismas en los ultimos 90 dias. Solo para revisar: no se suspende a nadie por esto."
      />
    </section>
  );
}
