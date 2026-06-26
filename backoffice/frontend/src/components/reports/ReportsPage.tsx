import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as reportsApi from '@/api/reports';
import MetricCard from '@/components/shared/MetricCard';
import Badge from '@/components/shared/Badge';
import Pagination from '@/components/shared/Pagination';
import Modal from '@/components/shared/Modal';
import DetailRow from '@/components/shared/DetailRow';
import { formatDateTime } from '@/utils/formatters';
import { PAGE_SIZES } from '@/utils/constants';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';

export default function ReportsPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [reporterType, setReporterType] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', search, reporterType, startDate, endDate, page],
    queryFn: () =>
      reportsApi.getReports({
        search: search || undefined,
        reporterType: reporterType !== 'ALL' ? reporterType : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        size: PAGE_SIZES.MEDIATIONS, // usar el mismo tamaño por defecto que mediaciones
      }),
  });

  const { data: summary } = useQuery({
    queryKey: ['reports-summary'],
    queryFn: reportsApi.getReportsSummary,
  });

  const reports = data?.content ?? [];
  const selectedReport = reports.find((r) => r.id === selectedReportId);

  const handleOpenDetail = (id: number) => {
    setSelectedReportId(id);
    setIsDetailOpen(true);
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Reportes de Chat</h1>
          <p>Gestión y seguimiento de reportes realizados en chats entre compradores y vendedores</p>
        </div>
        <div className="header-actions">
          <AreaHomeShortcut />
        </div>
      </div>

      <section className="metric-grid compact" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <MetricCard
          label="Total reportes"
          value={summary?.totalReportes ?? 0}
          tone="violet"
          iconName="flag"
          description="Total de reportes registrados en la plataforma"
        />
        <MetricCard
          label="Por compradores"
          value={summary?.reportesCompradores ?? 0}
          tone="blue"
          iconName="users"
          description="Reportes emitidos por compradores hacia vendedores"
        />
        <MetricCard
          label="Por vendedores"
          value={summary?.reportesVendedores ?? 0}
          tone="amber"
          iconName="users"
          description="Reportes emitidos por vendedores hacia compradores"
        />
      </section>

      <div className="panel">
        <div className="panel-header">
          <h2>Lista de Reportes</h2>
          <span className="panel-count">{data?.totalElements ?? 0}</span>
        </div>

        <div 
          className="seller-filter-bar" 
          style={{ 
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 2fr) minmax(150px, 1.2fr) minmax(180px, 1.5fr) minmax(180px, 1.5fr)',
            gap: '16px',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'transparent'
          }}
        >
          <input
            type="search"
            className="input"
            placeholder="Buscar por nombre, motivo o descripción..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          <select
            className="select"
            value={reporterType}
            onChange={(e) => {
              setReporterType(e.target.value);
              setPage(0);
            }}
            aria-label="Tipo de reportante"
          >
            <option value="ALL">Todos los reportantes</option>
            <option value="COMPRADOR">Compradores</option>
            <option value="VENDEDOR">Vendedores</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <span style={{ fontSize: 13, color: '#b9c7d8', whiteSpace: 'nowrap' }}>Desde:</span>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
              aria-label="Fecha inicio"
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <span style={{ fontSize: 13, color: '#b9c7d8', whiteSpace: 'nowrap' }}>Hasta:</span>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
              aria-label="Fecha fin"
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="panel-body">Cargando reportes...</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 180 }}>ID</th>
                    <th>Reportante</th>
                    <th>Reportado</th>
                    <th>Motivo</th>
                    <th>Descripción</th>
                    <th>Fecha</th>
                    <th style={{ width: 100 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                        No se encontraron reportes.
                      </td>
                    </tr>
                  ) : (
                    reports.map((report) => (
                      <tr key={report.id}>
                        <td style={{ whiteSpace: 'nowrap' }}><strong>{report.idExterno || `#${report.id}`}</strong></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <strong>{report.reportanteName}</strong>
                            <span>{report.reportanteEmail}</span>
                            <Badge
                              text={report.reportanteType}
                              variant={report.reportanteType === 'COMPRADOR' ? 'blue' : 'amber'}
                            />
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <strong>{report.reportadoName}</strong>
                            <span>{report.reportadoEmail}</span>
                            <Badge
                              text={report.reportadoType}
                              variant={report.reportadoType === 'COMPRADOR' ? 'blue' : 'amber'}
                            />
                          </div>
                        </td>
                        <td>
                          <strong>{report.motivo}</strong>
                        </td>
                        <td>
                          <span
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 300,
                            }}
                          >
                            {report.descripcion}
                          </span>
                        </td>
                        <td>{formatDateTime(report.fechaCreacion)}</td>
                        <td>
                          <button
                            className="row-action"
                            onClick={() => handleOpenDetail(report.id)}
                            title="Ver Detalle"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '4px',
                              padding: '6px 12px',
                              color: '#fff',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            Detalle
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={data?.totalPages ?? 0}
              totalItems={data?.totalElements ?? 0}
              pageSize={PAGE_SIZES.MEDIATIONS}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Detalle del Reporte"
        wide
      >
        {selectedReport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="panel" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6 }}>
                  Reportante (Quién reporta)
                </h3>
                <DetailRow label="Nombre" value={selectedReport.reportanteName} />
                <DetailRow label="Email" value={selectedReport.reportanteEmail} />
                <DetailRow
                  label="Tipo"
                  value={
                    <Badge
                      text={selectedReport.reportanteType}
                      variant={selectedReport.reportanteType === 'COMPRADOR' ? 'blue' : 'amber'}
                    />
                  }
                />
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6 }}>
                  Reportado (Hacia quién)
                </h3>
                <DetailRow label="Nombre" value={selectedReport.reportadoName} />
                <DetailRow label="Email" value={selectedReport.reportadoEmail} />
                <DetailRow
                  label="Tipo"
                  value={
                    <Badge
                      text={selectedReport.reportadoType}
                      variant={selectedReport.reportadoType === 'COMPRADOR' ? 'blue' : 'amber'}
                    />
                  }
                />
              </div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6 }}>
                Detalles de la Denuncia
              </h3>
              <DetailRow label="ID de Reporte" value={selectedReport.idExterno || `#${selectedReport.id}`} />
              <DetailRow label="Fecha del Reporte" value={formatDateTime(selectedReport.fechaCreacion)} />
              <DetailRow label="Motivo" value={selectedReport.motivo} />
              {selectedReport.conversacionId && (
                <DetailRow label="Conversación ID" value={String(selectedReport.conversacionId)} />
              )}
              <div style={{ marginTop: 12 }}>
                <strong>Descripción:</strong>
                <p
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    padding: 12,
                    borderRadius: 4,
                    marginTop: 6,
                    whiteSpace: 'pre-wrap',
                    color: '#e2e8f0',
                  }}
                >
                  {selectedReport.descripcion}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
