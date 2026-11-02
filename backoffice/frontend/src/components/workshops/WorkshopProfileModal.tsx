import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWorkshopDetail } from '@/api/workshops';
import { downloadServiceDocument, viewServiceDocument } from '@/api/capturers';
import { resolveProfileImageUrl } from '@/api/client';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { WorkshopDetail, WorkshopDiagnostic, WorkshopSummary } from '@/types/workshop';
import { getPurchaseNeedLabel, getPurchaseNeedTone, getWorkshopStatusLabel, getWorkshopStatusTone } from './status';

export type WorkshopProfileTab = 'reportes' | 'diagnosticos' | 'comentarios' | 'necesidades';

interface WorkshopProfileModalProps {
  workshop: WorkshopSummary | null;
  onClose: () => void;
  /** Pestaña de actividad con la que abre (p. ej. "reportes" desde el atajo de la tabla). */
  initialTab?: WorkshopProfileTab;
}

function priceRange(item: WorkshopDiagnostic) {
  if (item.precioDesde == null && item.precioHasta == null) return 'Sin precio';
  if (item.precioDesde != null && item.precioHasta != null && item.precioDesde !== item.precioHasta) {
    return `${formatCurrency(item.precioDesde)} – ${formatCurrency(item.precioHasta)}`;
  }
  return formatCurrency((item.precioDesde ?? item.precioHasta) as number);
}

function SectionHeader({ icon, title, count, tone = 'blue' }: { icon: string; title: string; count?: string; tone?: 'blue' | 'violet' | 'red' | 'green' | 'amber' }) {
  return (
    <div className="seller-profile-section-header">
      <span className={`seller-profile-section-icon ${tone}`}><UiIcon name={icon} /></span>
      <h3>{title}</h3>
      {count ? <span className="seller-profile-section-count">{count}</span> : null}
    </div>
  );
}

function InfoStat({ label, value, sub, className = '' }: { label: string; value: string | number; sub?: string; className?: string }) {
  return (
    <div className={`seller-profile-info-stat ${className}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

/** Extension del archivo en mayusculas (PDF, JPG...); vacio si no hay archivo. */
function fileFormat(name?: string | null) {
  const match = name?.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1] ? match[1].toUpperCase() : '—';
}

function DocumentsPanel({ detail }: { detail: WorkshopDetail }) {
  const fail = (action: string, label: string) => (error: unknown) =>
    showToast(error instanceof Error ? error.message : `No se pudo ${action} ${label.toLowerCase()}.`);

  return (
    <div className="table-wrap seller-profile-documents-wrap" style={{ overflowX: 'auto' }}>
      <table className="wide-table seller-profile-table" style={{ tableLayout: 'auto', minWidth: 720 }}>
        <thead>
          <tr>
            <th>Documento</th><th>Archivo</th><th>Formato</th><th>Estado</th>
            <th>Enviada</th><th>Revisión</th><th style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {detail.documentos.map((doc) => (
            <tr key={doc.tipo}>
              <td style={{ whiteSpace: 'normal' }}><strong>{doc.etiqueta}</strong><div className="row-sub">Obligatorio</div></td>
              <td style={{ overflowWrap: 'anywhere', minWidth: 130 }}>{doc.nombre || '—'}</td>
              <td>{fileFormat(doc.nombre)}</td>
              <td><Badge text={doc.nombre ? 'Cargado' : 'Pendiente'} variant={doc.nombre ? 'green' : 'amber'} /></td>
              <td style={{ whiteSpace: 'nowrap' }}>{detail.submittedAt ? formatDate(detail.submittedAt) : '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{detail.reviewedAt ? formatDate(detail.reviewedAt) : '—'}</td>
              <td style={{ textAlign: 'right' }}>
                {doc.nombre ? (
                  <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="secondary-button" type="button" style={{ padding: '5px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                      onClick={() => void viewServiceDocument(detail.servicioId, doc.tipo).catch(fail('ver', doc.etiqueta))}>
                      <UiIcon name="eye" style={{ width: 13, height: 13 }} /> Ver
                    </button>
                    <button className="secondary-button" type="button" style={{ padding: '5px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                      onClick={() => void downloadServiceDocument(detail.servicioId, doc.tipo, doc.nombre as string).catch(fail('descargar', doc.etiqueta))}>
                      <UiIcon name="download" style={{ width: 13, height: 13 }} /> Descargar
                    </button>
                  </div>
                ) : <span className="row-sub">Sin archivo</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ACTIVITY_PAGE_SIZE = 5;

function ActivityPagination({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.ceil(total / ACTIVITY_PAGE_SIZE);
  if (totalPages <= 1) return null;
  return (
    <div className="pagination compact-pagination seller-profile-pagination">
      <span>Mostrando {page * ACTIVITY_PAGE_SIZE + 1} a {Math.min((page + 1) * ACTIVITY_PAGE_SIZE, total)} de {total}</span>
      <div className="page-buttons">
        <button className="page-button page-prev" type="button" onClick={() => onPageChange(page - 1)} disabled={page === 0} aria-label="Página anterior"><UiIcon name="arrowRight" /></button>
        {Array.from({ length: totalPages }, (_, index) => index).map((item) => (
          <button key={item} className={`page-button ${item === page ? 'active' : ''}`} type="button" onClick={() => onPageChange(item)}>{item + 1}</button>
        ))}
        <button className="page-button" type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages - 1} aria-label="Página siguiente"><UiIcon name="arrowRight" /></button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="row-sub" style={{ padding: '12px 0' }}>{text}</p>;
}

/** Perfil del taller (mismo diseño que el perfil del vendedor): datos, métricas clave, documentos descargables y actividad. */
export default function WorkshopProfileModal({ workshop, onClose, initialTab = 'reportes' }: WorkshopProfileModalProps) {
  const [tab, setTab] = useState<WorkshopProfileTab>(initialTab);
  const [page, setPage] = useState(0);
  const workshopId = workshop?.id ?? 0;

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['workshop-detail', workshopId],
    queryFn: () => getWorkshopDetail(workshopId),
    enabled: workshopId > 0,
  });

  const stats = useMemo(() => {
    if (!detail) return null;
    const needs = detail.necesidades;
    return {
      accepted: detail.diagnosticos.filter((d) => d.aceptado).length,
      needsActive: needs.filter((n) => n.estado === 'ACTIVA').length,
      needsDone: needs.filter((n) => n.estado === 'FINALIZADA').length,
      needsCancelled: needs.filter((n) => n.estado === 'CANCELADA' || n.estado === 'EXPIRADA').length,
      quotes: needs.reduce((total, n) => total + n.cotizaciones, 0),
      docsLoaded: detail.documentos.filter((d) => d.nombre).length,
    };
  }, [detail]);

  if (!workshop) return null;

  const summary = detail?.resumen ?? workshop;
  const photo = summary.userProfileUrl ? resolveProfileImageUrl(summary.userProfileUrl) : null;
  const rating = summary.calificacion != null ? summary.calificacion.toFixed(1) : '—';
  const tabs: Array<{ key: WorkshopProfileTab; label: string; count: number }> = [
    { key: 'reportes', label: 'Reportes', count: summary.reportes },
    { key: 'diagnosticos', label: 'Diagnósticos', count: summary.diagnosticos },
    { key: 'comentarios', label: 'Comentarios', count: summary.comentarios },
    { key: 'necesidades', label: 'Necesidades de compra', count: summary.necesidades },
  ];
  const diagnosticRows = tab === 'diagnosticos' ? detail?.diagnosticos : detail?.comentarios;
  const pageOf = <T,>(rows: T[] | undefined) => (rows ?? []).slice(page * ACTIVITY_PAGE_SIZE, (page + 1) * ACTIVITY_PAGE_SIZE);

  return (
    <div className="case-modal-backdrop seller-profile-backdrop" onClick={onClose}>
      <div className="seller-profile-modal" onClick={(event) => event.stopPropagation()}>
        <button className="seller-profile-close" type="button" onClick={onClose} aria-label="Cerrar">
          <UiIcon name="close" />
        </button>
        <div className="seller-profile-layout">
          <aside className="seller-profile-sidebar">
            <div className="seller-profile-breadcrumbs">
              <span>Talleres</span>
              <UiIcon name="arrowRight" />
              <strong>{summary.nombreNegocio}</strong>
            </div>

            <div className="seller-profile-card">
              <div className={`seller-profile-avatar logo-${summary.id % 8}`}>
                {photo ? <img src={photo} alt={summary.nombreNegocio} /> : summary.nombreNegocio.substring(0, 2).toUpperCase()}
              </div>
              <h2>{summary.nombreNegocio}</h2>
              <span className="seller-profile-id">Taller #{summary.id}</span>

              <div className="seller-profile-subinfo">
                <span><UiIcon name="users" /> RUT {summary.rut}</span>
                <span><UiIcon name="home" /> {[summary.direccion, summary.comuna, summary.region].filter(Boolean).join(', ') || 'Sin dirección'}</span>
                {summary.email && <span><UiIcon name="mail" /> {summary.email}</span>}
                {summary.responsable && <span><UiIcon name="users" /> Responsable: {summary.responsable}</span>}
                {summary.telefono && <span><UiIcon name="smartphone" /> Teléfono: {summary.telefono}</span>}
              </div>

              <div className="seller-profile-badges">
                <Badge text={getWorkshopStatusLabel(summary.estado)} variant={getWorkshopStatusTone(summary.estado)} />
                <Badge text={summary.cuentaActiva ? 'Cuenta activa' : 'Cuenta inactiva'} variant={summary.cuentaActiva ? 'green' : 'red'} />
                {detail?.atiende24Horas && <Badge text="24 horas" variant="violet" />}
                {detail?.permiteReservas && <Badge text="Recibe reservas" variant="blue" />}
                {detail?.servicioDomicilio && <Badge text="A domicilio" variant="blue" />}
              </div>
            </div>

            <div className="seller-profile-quick-panel">
              <SectionHeader icon="shield" title="Resumen rápido" tone="violet" />
              <InfoStat label="Reportes recibidos" value={summary.reportes} />
              <InfoStat label="Diagnósticos" value={summary.diagnosticos} />
              <InfoStat label="Necesidades de compra" value={summary.necesidades} />
            </div>

            <div className="seller-profile-footer-info">
              <span>Ingreso el {summary.createdAt ? formatDate(summary.createdAt) : 'sin fecha'}</span>
              <strong>Última actividad: {summary.ultimaActividad ? formatDate(summary.ultimaActividad) : 'sin datos'}</strong>
            </div>
          </aside>

          <main className="seller-profile-main">
            {isError && <p className="row-sub">No se pudo cargar la ficha del taller.</p>}
            {isLoading && <p className="row-sub">Cargando ficha del taller...</p>}

            <section className="seller-profile-metric-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
              <InfoStat className="seller-profile-metric-stat" label="Acreditación" value={getWorkshopStatusLabel(summary.estado)}
                sub={detail?.reviewedAt ? `Revisada el ${formatDate(detail.reviewedAt)}` : detail?.submittedAt ? `Enviada el ${formatDate(detail.submittedAt)}` : 'Sin solicitud enviada'} />
              <InfoStat className="seller-profile-metric-stat" label="Calificación" value={rating}
                sub={summary.opiniones ? `${summary.opiniones} opinión${summary.opiniones === 1 ? '' : 'es'}` : 'Sin opiniones'} />
              <InfoStat className="seller-profile-metric-stat" label="Reportes" value={summary.reportes} sub="Recibidos" />
              <InfoStat className="seller-profile-metric-stat" label="Documentos" value={stats ? `${stats.docsLoaded} / ${detail?.documentos.length ?? 3}` : '—'} sub="Cargados" />
            </section>

            <section className="seller-profile-metric-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
              <InfoStat className="seller-profile-metric-stat" label="Diagnósticos" value={summary.diagnosticos} sub={stats ? `${stats.accepted} aceptado${stats.accepted === 1 ? '' : 's'}` : undefined} />
              <InfoStat className="seller-profile-metric-stat" label="Comentarios" value={summary.comentarios} sub="En fallas automotrices" />
              <InfoStat className="seller-profile-metric-stat" label="Necesidades de compra" value={summary.necesidades}
                sub={stats ? `${stats.needsActive} activa${stats.needsActive === 1 ? '' : 's'} · ${stats.needsDone} finalizada${stats.needsDone === 1 ? '' : 's'}` : undefined} />
              <InfoStat className="seller-profile-metric-stat" label="Cotizaciones recibidas" value={stats?.quotes ?? '—'}
                sub={stats ? `${stats.needsCancelled} cancelada${stats.needsCancelled === 1 ? '' : 's'} o expirada${stats.needsCancelled === 1 ? '' : 's'}` : undefined} />
            </section>

            {detail?.notasRevision && (
              <p className="row-sub"><strong>Notas de la revisión:</strong> {detail.notasRevision}</p>
            )}

            <section className="seller-profile-content-grid">
              {detail && (
                <div className="seller-profile-panel documents-panel" style={{ gridArea: 'auto', gridColumn: '1 / -1' }}>
                  <SectionHeader icon="document" title="Documentos del taller" count={`${stats?.docsLoaded ?? 0}/${detail.documentos.length}`} tone="amber" />
                  <DocumentsPanel detail={detail} />
                </div>
              )}

              <div className="seller-profile-panel activity-panel" style={{ gridArea: 'auto', gridColumn: '1 / -1' }}>
                <nav className="module-tabs" style={{ margin: '0 0 14px' }} aria-label="Actividad del taller">
                  {tabs.map((item) => (
                    <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} onClick={() => { setTab(item.key); setPage(0); }}>
                      {item.label} ({item.count})
                    </button>
                  ))}
                </nav>

                {detail && tab === 'reportes' && (
                  detail.reportes.length ? (
                    <div className="table-wrap">
                      <table className="wide-table seller-profile-table">
                        <thead><tr><th>ID</th><th>Reportante</th><th>Objeto</th><th>Motivo</th><th>Descripción</th><th>Fecha</th></tr></thead>
                        <tbody>
                          {pageOf(detail.reportes).map((report) => (
                            <tr key={report.id}>
                              <td style={{ whiteSpace: 'nowrap' }}><strong>{report.idExterno || `#${report.id}`}</strong></td>
                              <td><strong>{report.reportanteName}</strong><div className="row-sub">{report.reportanteEmail}</div></td>
                              <td>{report.objetoTitulo || report.tipoObjeto || '—'}</td>
                              <td>{report.motivo}</td>
                              <td>{report.descripcion || '—'}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{formatDate(report.fechaCreacion)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <Empty text="Este taller no tiene reportes." />
                )}

                {detail && (tab === 'diagnosticos' || tab === 'comentarios') && (
                  diagnosticRows?.length ? (
                    <div className="table-wrap">
                      <table className="wide-table seller-profile-table">
                        <thead>
                          <tr>
                            <th>Falla</th><th>Vehículo</th><th>{tab === 'diagnosticos' ? 'Diagnóstico' : 'Comentario'}</th>
                            {tab === 'diagnosticos' && <th>Precio</th>}
                            {tab === 'diagnosticos' && <th>Estado</th>}
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageOf(diagnosticRows).map((item) => (
                            <tr key={item.id}>
                              <td><strong>{item.fallaTitulo}</strong><div className="row-sub">Falla #{item.fallaId}</div></td>
                              <td>{item.vehiculo || '—'}</td>
                              <td style={{ maxWidth: 360 }}>{item.texto}</td>
                              {tab === 'diagnosticos' && <td style={{ whiteSpace: 'nowrap' }}>{priceRange(item)}</td>}
                              {tab === 'diagnosticos' && <td><Badge text={item.aceptado ? 'Aceptado' : 'Sin aceptar'} variant={item.aceptado ? 'green' : 'amber'} /></td>}
                              <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <Empty text={tab === 'diagnosticos' ? 'Este taller aún no deja diagnósticos en fallas automotrices.' : 'Este taller aún no deja comentarios en fallas automotrices.'} />
                )}

                {detail && tab === 'necesidades' && (
                  detail.necesidades.length ? (
                    <div className="table-wrap">
                      <table className="wide-table seller-profile-table">
                        <thead><tr><th>N°</th><th>Repuesto</th><th>Vehículo</th><th>Cant.</th><th>Estado</th><th>Cotizaciones</th><th>Publicada</th></tr></thead>
                        <tbody>
                          {pageOf(detail.necesidades).map((need) => (
                            <tr key={need.id}>
                              <td><strong>#{need.id}</strong></td>
                              <td style={{ maxWidth: 280 }}>{need.repuesto}</td>
                              <td>{need.vehiculo || '—'}{need.patente ? <div className="row-sub">{need.patente}</div> : null}</td>
                              <td>{need.cantidad}</td>
                              <td>
                                <Badge text={getPurchaseNeedLabel(need.estado)} variant={getPurchaseNeedTone(need.estado)} />
                                {need.motivoCancelacion && <div className="row-sub">{need.motivoCancelacion}</div>}
                              </td>
                              <td>{need.cotizaciones}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{formatDate(need.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <Empty text="Este taller no ha publicado necesidades de compra." />
                )}

                {detail && (
                  <ActivityPagination
                    page={page}
                    total={tab === 'reportes' ? detail.reportes.length : tab === 'necesidades' ? detail.necesidades.length : (diagnosticRows?.length ?? 0)}
                    onPageChange={setPage}
                  />
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
