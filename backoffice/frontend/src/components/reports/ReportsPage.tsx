import { useState, useMemo } from 'react';
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
import FounderSellerName from '@/components/shared/FounderSellerName';
import type { ReportObjectType, ReportResponse } from '@/types/report';

const OBJECT_TYPE_META: Record<ReportObjectType, { label: string; tone: string }> = {
  ANUNCIO: { label: 'Anuncio', tone: 'blue' },
  PRODUCTO: { label: 'Producto', tone: 'violet' },
  TIENDA: { label: 'Tienda', tone: 'green' },
  CHAT_COTIZACION: { label: 'Chat de cotización', tone: 'amber' },
  OTRO: { label: 'Otro', tone: '' },
};

function reportObjectType(report: ReportResponse): ReportObjectType {
  return report.tipoObjeto ?? (report.conversacionId ? 'CHAT_COTIZACION' : 'OTRO');
}

export default function ReportsPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [objectTypeFilter, setObjectTypeFilter] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Consulta para obtener la totalidad de reportes y extraer la lista única de nombres
  const { data: allReportsData } = useQuery({
    queryKey: ['all-reports-names'],
    queryFn: () => reportsApi.getReports({ size: 1000 }),
  });

  const reportsList = allReportsData?.content ?? [];

  const storeNames = useMemo(() => {
    const names = new Set<string>();
    reportsList.forEach((r) => {
      if (r.reportanteType === 'VENDEDOR') names.add(r.reportanteName);
      if (r.reportadoType === 'VENDEDOR') names.add(r.reportadoName);
    });
    return Array.from(names).sort();
  }, [reportsList]);

  const buyerNames = useMemo(() => {
    const names = new Set<string>();
    reportsList.forEach((r) => {
      if (r.reportanteType === 'COMPRADOR') names.add(r.reportanteName);
      if (r.reportadoType === 'COMPRADOR') names.add(r.reportadoName);
    });
    return Array.from(names).sort();
  }, [reportsList]);

  const responsibleOptions = useMemo(() => {
    if (typeFilter === 'VENDEDOR') return storeNames;
    if (typeFilter === 'COMPRADOR') return buyerNames;
    return Array.from(new Set([...storeNames, ...buyerNames])).sort();
  }, [typeFilter, storeNames, buyerNames]);

  // Mapear los filtros anidados a los parámetros de backend
  const reporterTypeParam = useMemo(() => {
    if (originFilter === 'REPORTANTE') {
      if (typeFilter === 'VENDEDOR') return 'VENDEDOR';
      if (typeFilter === 'COMPRADOR') return 'COMPRADOR';
    }
    if (originFilter === 'REPORTADO') {
      if (typeFilter === 'VENDEDOR') return 'COMPRADOR';
      if (typeFilter === 'COMPRADOR') return 'VENDEDOR';
    }
    if (typeFilter === 'VENDEDOR') return 'VENDEDOR';
    if (typeFilter === 'COMPRADOR') return 'COMPRADOR';
    return undefined;
  }, [originFilter, typeFilter]);

  const searchParam = useMemo(() => {
    if (responsibleFilter && responsibleFilter !== 'ALL') {
      return responsibleFilter;
    }
    return search || undefined;
  }, [responsibleFilter, search]);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', searchParam, reporterTypeParam, objectTypeFilter, page],
    queryFn: () =>
      reportsApi.getReports({
        search: searchParam,
        reporterType: reporterTypeParam,
        objectType: objectTypeFilter || undefined,
        page,
        size: PAGE_SIZES.MEDIATIONS,
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
          <h1>Reportes</h1>
          <p>Gestión de reportes enviados desde la aplicación sobre anuncios, productos, tiendas y chats de cotización</p>
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

      <section className="metric-grid compact" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <MetricCard label="Anuncios" value={summary?.reportesAnuncios ?? 0} tone="blue" iconName="megaphone" description="Publicaciones publicitarias reportadas" />
        <MetricCard label="Productos" value={summary?.reportesProductos ?? 0} tone="violet" iconName="cube" description="Repuestos reportados desde su detalle" />
        <MetricCard label="Tiendas" value={summary?.reportesTiendas ?? 0} tone="green" iconName="home" description="Perfiles de tienda reportados" />
        <MetricCard label="Chats de cotización" value={summary?.reportesChatsCotizacion ?? 0} tone="amber" iconName="message" description="Conversaciones de cotización reportadas" />
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
            gridTemplateColumns: 'minmax(220px, 2fr) repeat(4, minmax(140px, 1fr))',
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
            placeholder="Buscar por motivo o descripción..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setResponsibleFilter('');
              setPage(0);
            }}
          />
          <select
            className="select"
            value={objectTypeFilter}
            onChange={(e) => {
              setObjectTypeFilter(e.target.value);
              setPage(0);
            }}
            aria-label="Contenido reportado"
          >
            <option value="">Todo el contenido</option>
            <option value="ANUNCIO">Anuncios</option>
            <option value="PRODUCTO">Productos</option>
            <option value="TIENDA">Tiendas</option>
            <option value="CHAT_COTIZACION">Chats de cotización</option>
          </select>
          <select
            className="select"
            value={originFilter}
            onChange={(e) => {
              setOriginFilter(e.target.value);
              setTypeFilter('');
              setResponsibleFilter('');
              setPage(0);
            }}
            aria-label="Origen del reporte"
          >
            <option value="">Seleccione origen...</option>
            <option value="ALL">Todos</option>
            <option value="REPORTANTE">Reportante</option>
            <option value="REPORTADO">Reportado</option>
          </select>
          <select
            className="select"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setResponsibleFilter('');
              setPage(0);
            }}
            disabled={!originFilter}
            aria-label="Tipo de reporte"
          >
            <option value="">Seleccione tipo...</option>
            <option value="ALL">Todos</option>
            <option value="VENDEDOR">Vendedor</option>
            <option value="COMPRADOR">Comprador</option>
          </select>
          <select
            className="select"
            value={responsibleFilter}
            onChange={(e) => {
              setResponsibleFilter(e.target.value);
              setPage(0);
            }}
            disabled={!originFilter || !typeFilter}
            aria-label="Responsable del reporte"
          >
            <option value="">Seleccione responsable...</option>
            <option value="ALL">Todos</option>
            {responsibleOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
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
                    <th>Origen</th>
                    <th>Contenido</th>
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
                      <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>
                        No se encontraron reportes.
                      </td>
                    </tr>
                  ) : (
                    reports.map((report) => (
                      <tr key={report.id}>
                        <td style={{ whiteSpace: 'nowrap' }}><strong>{report.idExterno || `#${report.id}`}</strong></td>
                        <td>
                          <Badge
                            text={OBJECT_TYPE_META[reportObjectType(report)].label}
                            variant={OBJECT_TYPE_META[reportObjectType(report)].tone}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
                            <strong>{report.objetoTitulo || OBJECT_TYPE_META[reportObjectType(report)].label}</strong>
                            {(report.objetoId || report.conversacionId) && (
                              <span>#{report.objetoId ?? report.conversacionId}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <strong>
                              <FounderSellerName
                                name={report.reportanteName}
                                founder={report.reportanteType === 'VENDEDOR' && report.reportanteFounder}
                              />
                            </strong>
                            <span>{report.reportanteEmail}</span>
                            <Badge
                              text={report.reportanteType}
                              variant={report.reportanteType === 'COMPRADOR' ? 'blue' : 'amber'}
                            />
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <strong>
                              <FounderSellerName
                                name={report.reportadoName}
                                founder={report.reportadoType === 'VENDEDOR' && report.reportadoFounder}
                              />
                            </strong>
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
                <DetailRow
                  label="Nombre"
                  value={<FounderSellerName name={selectedReport.reportanteName} founder={selectedReport.reportanteType === 'VENDEDOR' && selectedReport.reportanteFounder} />}
                />
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
                <DetailRow
                  label="Nombre"
                  value={<FounderSellerName name={selectedReport.reportadoName} founder={selectedReport.reportadoType === 'VENDEDOR' && selectedReport.reportadoFounder} />}
                />
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
              <DetailRow
                label="Origen"
                value={OBJECT_TYPE_META[reportObjectType(selectedReport)].label}
              />
              {selectedReport.objetoTitulo && (
                <DetailRow label="Contenido reportado" value={selectedReport.objetoTitulo} />
              )}
              {selectedReport.objetoId && (
                <DetailRow label="ID del contenido" value={String(selectedReport.objetoId)} />
              )}
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
