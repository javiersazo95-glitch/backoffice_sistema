import { useQuery } from '@tanstack/react-query';
import { getSellerReports } from '@/api/sellers';
import UiIcon from '@/components/shared/UiIcon';
import SellerCaseSummaryCard from './SellerCaseSummaryCard';

interface ReportsSummaryProps {
  sellerId: number;
  reportCount: number;
}

export default function ReportsSummary({ sellerId, reportCount }: ReportsSummaryProps) {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['seller-reports', sellerId],
    queryFn: () => getSellerReports(sellerId),
    enabled: reportCount > 0,
  });

  if (!isLoading && reports.length === 0) return null;

  return (
    <section className="summary-card">
      <div className="summary-card-header">
        <span className="status-icon red">
          <UiIcon name="flag" />
        </span>
        <div>
          <h3>Reportes</h3>
          <p>Reportes registrados contra este vendedor</p>
        </div>
        <strong>{isLoading ? '—' : reports.length}</strong>
      </div>
      <div className="insight-body">
        {isLoading ? (
          <div className="empty-insight">
            <p>Cargando reportes...</p>
          </div>
        ) : (
          reports.map((report) => (
            <SellerCaseSummaryCard
              key={report.id}
              tone="red"
              icon="flag"
              status={report.reportanteType === 'VENDEDOR' ? 'Reporta tienda' : 'Reporta comprador'}
              statusVariant="red"
              summary={report.motivo}
              orderId={report.idExterno || `#${report.id}`}
              reason={report.motivo}
              referenceLabel="Reporte"
              buyer={report.reportanteName}
              participantLabel="Reportante"
              stage={report.objetoTitulo || report.tipoObjeto}
              stageLabel="Objeto reportado"
              updated={report.fechaCreacion}
            />
          ))
        )}
      </div>
    </section>
  );
}
