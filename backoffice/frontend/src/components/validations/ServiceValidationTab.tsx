import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/capturers';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import type { AutomotiveServiceReview } from '@/types/capturer';

type ServiceStatus = 'PENDIENTE' | 'POR_CORREGIR' | 'APROBADO' | 'RECHAZADO';
type StatusFilter = 'TODOS' | ServiceStatus;
type DecisionAction = 'request-correction' | 'reject';

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio',
  '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

const STATUS_META: Record<ServiceStatus, { label: string; pill: string; icon: string }> = {
  PENDIENTE: { label: 'Pendiente', pill: 'tone-amber', icon: 'clock' },
  POR_CORREGIR: { label: 'Por corregir', pill: 'tone-blue', icon: 'refresh' },
  APROBADO: { label: 'Aprobado', pill: 'tone-green', icon: 'check' },
  RECHAZADO: { label: 'Rechazado', pill: 'tone-red', icon: 'shieldX' },
};

const DOCUMENTS = [
  { label: 'Identidad / RUT', tipo: 'identidad', field: 'documentoIdentidadNombre' },
  { label: 'Inicio de actividades (SII)', tipo: 'inicio-actividades', field: 'inicioActividadesNombre' },
  { label: 'Patente municipal', tipo: 'patente-municipal', field: 'patenteMunicipalNombre' },
] as const;

function statusOf(s: AutomotiveServiceReview): ServiceStatus {
  return (s.estado in STATUS_META ? s.estado : 'PENDIENTE') as ServiceStatus;
}

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  const d = new Date(value);
  return isNaN(d.getTime()) ? 'Sin fecha' : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ServiceValidationTab() {
  const qc = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<AutomotiveServiceReview | null>(null);
  const [decision, setDecision] = useState<{ target: AutomotiveServiceReview; action: DecisionAction } | null>(null);
  const [notes, setNotes] = useState('');

  const query = useQuery({ queryKey: ['automotive-service-validations'], queryFn: api.listServices });
  const services = query.data ?? [];

  const mutation = useMutation({
    mutationFn: ({ id, action, notas }: { id: number; action: 'approve' | DecisionAction; notas?: string }) =>
      api.decideService(id, action, notas || ''),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['automotive-service-validations'] });
      showToast(action === 'approve' ? '✓ Servicio automotriz acreditado.' : action === 'reject' ? 'Expediente rechazado.' : 'Corrección solicitada al servicio.');
      setDecision(null);
      setDetail(null);
      setNotes('');
    },
    onError: () => showToast('No se pudo registrar la decisión.'),
  });

  const yearOptions = useMemo(() => {
    const years = new Set<string>([String(new Date().getFullYear())]);
    services.forEach((s) => { if (s.submittedAt) years.add(s.submittedAt.slice(0, 4)); });
    return ['ALL', ...Array.from(years).sort().reverse()];
  }, [services]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    services.forEach((s) => {
      if (!s.submittedAt) return;
      if (selectedYear !== 'ALL' && !s.submittedAt.startsWith(selectedYear)) return;
      const m = s.submittedAt.slice(5, 7);
      if (MONTH_NAMES[m]) months.add(m);
    });
    return [{ value: 'ALL', label: 'Todos los meses' }, ...Array.from(months).sort().map((m) => ({ value: m, label: MONTH_NAMES[m] as string }))];
  }, [services, selectedYear]);

  const metrics = useMemo(() => ({
    total: services.length,
    pendientes: services.filter((s) => statusOf(s) === 'PENDIENTE').length,
    porCorregir: services.filter((s) => statusOf(s) === 'POR_CORREGIR').length,
    aprobados: services.filter((s) => statusOf(s) === 'APROBADO').length,
    rechazados: services.filter((s) => statusOf(s) === 'RECHAZADO').length,
  }), [services]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return services.filter((s) => {
      if (statusFilter !== 'TODOS' && statusOf(s) !== statusFilter) return false;
      if (s.submittedAt) {
        if (selectedYear !== 'ALL' && !s.submittedAt.startsWith(selectedYear)) return false;
        if (selectedMonth !== 'ALL' && s.submittedAt.slice(5, 7) !== selectedMonth) return false;
      } else if (selectedYear !== 'ALL' || selectedMonth !== 'ALL') {
        return false;
      }
      if (!term) return true;
      return (
        s.nombreNegocio.toLowerCase().includes(term) ||
        (s.rutNegocio || '').toLowerCase().includes(term) ||
        (s.responsable || '').toLowerCase().includes(term) ||
        (s.usuarioNombre || '').toLowerCase().includes(term) ||
        (s.usuarioEmail || '').toLowerCase().includes(term) ||
        (s.comuna || '').toLowerCase().includes(term) ||
        (s.region || '').toLowerCase().includes(term) ||
        (s.captadorAlias || '').toLowerCase().includes(term) ||
        String(s.id).includes(term)
      );
    });
  }, [services, searchTerm, statusFilter, selectedMonth, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const openDecision = (target: AutomotiveServiceReview, action: DecisionAction) => {
    setDecision({ target, action });
    setNotes('');
  };

  const exportCsv = () => {
    if (!filtered.length) { showToast('No hay expedientes para exportar con los filtros actuales.'); return; }
    const headers = ['ID', 'Negocio', 'RUT', 'Responsable', 'Solicitante', 'Correo', 'Comuna', 'Región', 'Captador', 'Estado', 'Enviado'];
    const rows = filtered.map((s) => [
      s.id, s.nombreNegocio, s.rutNegocio || '', s.responsable || '', s.usuarioNombre || '', s.usuarioEmail || '',
      s.comuna || '', s.region || '', s.captadorAlias ? `@${s.captadorAlias}` : '', s.estado, s.submittedAt || '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`));
    const csv = 'data:text/csv;charset=utf-8,﻿' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `servicios-automotrices-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const docName = (s: AutomotiveServiceReview, field: (typeof DOCUMENTS)[number]['field']) => s[field] as string | undefined;

  return (
    <div className="ad-validation-workspace">
      <div className="metric-grid compact publicidad-metric-grid">
        <div className="metric-card">
          <div className="metric-icon blue"><UiIcon name="store" /></div>
          <div><h3>Total expedientes</h3><strong>{metrics.total}</strong><p className="metric-description">Servicios automotrices</p></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon amber"><UiIcon name="clock" /></div>
          <div><h3>Pendientes</h3><strong>{metrics.pendientes}</strong><p className="metric-description">Por revisar acreditación</p></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon blue"><UiIcon name="refresh" /></div>
          <div><h3>Por corregir</h3><strong>{metrics.porCorregir}</strong><p className="metric-description">Esperando correcciones</p></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon green"><UiIcon name="check" /></div>
          <div><h3>Acreditados</h3><strong>{metrics.aprobados}</strong><p className="metric-description">Habilitados en la plataforma</p></div>
        </div>
      </div>

      <div className="notice">
        <p>
          <UiIcon name="info" />
          <span>
            Revisa la <strong>acreditación legal independiente</strong> de talleres y servicios automotrices: identidad del responsable, inicio de actividades y patente municipal. Aprueba, solicita correcciones o rechaza el expediente con observaciones para el solicitante.
          </span>
        </p>
      </div>

      <section className="table-shell">
        <div className="table-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap' }}>
          <input
            className="input"
            type="search"
            placeholder="Buscar por negocio, RUT, responsable, comuna, captador…"
            style={{ flex: 1, minWidth: 220 }}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />

          <div className="caja-filter-buttons" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button type="button" className={statusFilter === 'TODOS' ? 'primary-button' : 'secondary-button'} onClick={() => { setStatusFilter('TODOS'); setPage(1); }}>Todos ({metrics.total})</button>
            <button type="button" className={statusFilter === 'PENDIENTE' ? 'primary-button' : 'secondary-button'} onClick={() => { setStatusFilter('PENDIENTE'); setPage(1); }}>Pendientes ({metrics.pendientes})</button>
            <button type="button" className={statusFilter === 'POR_CORREGIR' ? 'primary-button' : 'secondary-button'} onClick={() => { setStatusFilter('POR_CORREGIR'); setPage(1); }}>Por corregir ({metrics.porCorregir})</button>
            <button type="button" className={statusFilter === 'APROBADO' ? 'primary-button' : 'secondary-button'} onClick={() => { setStatusFilter('APROBADO'); setPage(1); }}>Acreditados ({metrics.aprobados})</button>
            <button type="button" className={statusFilter === 'RECHAZADO' ? 'primary-button' : 'secondary-button'} onClick={() => { setStatusFilter('RECHAZADO'); setPage(1); }}>Rechazados ({metrics.rechazados})</button>
          </div>

          <select className="input" style={{ width: 'auto', flexShrink: 0 }} value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setPage(1); }} aria-label="Filtrar por mes">
            {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select className="input" style={{ width: 'auto', flexShrink: 0 }} value={selectedYear} onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }} aria-label="Filtrar por año">
            {yearOptions.map((y) => <option key={y} value={y}>{y === 'ALL' ? 'Todos los años' : y}</option>)}
          </select>

          <button className="icon-button" style={{ flexShrink: 0 }} type="button" onClick={exportCsv} title="Exportar CSV de servicios" aria-label="Exportar CSV de servicios">
            <UiIcon name="download" />
          </button>
        </div>

        <table className="wide-table">
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Solicitante</th>
              <th>Ubicación</th>
              <th style={{ textAlign: 'center' }}>Documentos</th>
              <th>Captador</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th>Enviado</th>
              <th style={{ width: 150, textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td colSpan={8}><div className="empty-state">Cargando expedientes de servicios…</div></td></tr>
            ) : query.isError ? (
              <tr><td colSpan={8}><div className="empty-state error">Error al cargar los expedientes de servicios.</div></td></tr>
            ) : paged.length > 0 ? (
              paged.map((s) => {
                const status = statusOf(s);
                const meta = STATUS_META[status];
                const loadedDocs = DOCUMENTS.filter((d) => docName(s, d.field)).length;
                const editable = status === 'PENDIENTE' || status === 'POR_CORREGIR';
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="ad-table-title-cell">
                        <div className="ad-table-title-main">{s.nombreNegocio}</div>
                        <div className="ad-table-title-sub">{s.rutNegocio || 'Sin RUT'} · {s.responsable || 'Sin responsable'}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, color: '#334155' }}>{s.usuarioNombre}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{s.usuarioEmail}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{s.comuna || '—'}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{s.region || 'Chile'}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-pill ${loadedDocs === DOCUMENTS.length ? 'tone-green' : 'tone-amber'}`}>{loadedDocs} / {DOCUMENTS.length}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: s.captadorAlias ? '#0284c7' : '#94a3b8', fontWeight: 600 }}>
                        {s.captadorAlias ? `@${s.captadorAlias}` : 'Directo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-pill ${meta.pill}`} style={{ gap: 5, cursor: s.notasRevision ? 'help' : 'default' }} title={s.notasRevision ? `Observación: ${s.notasRevision}` : undefined}>
                        <UiIcon name={meta.icon} style={{ width: 13, height: 13 }} />
                        {meta.label}
                      </span>
                    </td>
                    <td><div style={{ fontSize: 12, color: '#334155' }}>{formatDate(s.submittedAt)}</div></td>
                    <td>
                      <div className="action-cell" style={{ justifyContent: 'center' }}>
                        <button className="action-button issue" type="button" onClick={() => setDetail(s)} title="Ver expediente completo"><UiIcon name="eye" /></button>
                        {editable && (
                          <>
                            <button className="action-button success" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: s.id, action: 'approve' })} title="Aprobar acreditación"><UiIcon name="check" /></button>
                            <button className="action-button warning" type="button" disabled={mutation.isPending} onClick={() => openDecision(s, 'request-correction')} title="Solicitar corrección"><UiIcon name="refresh" /></button>
                            <button className="action-button delete" type="button" disabled={mutation.isPending} onClick={() => openDecision(s, 'reject')} title="Rechazar expediente"><UiIcon name="shieldX" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={8}><div className="empty-state">No se encontraron expedientes con los filtros aplicados.</div></td></tr>
            )}
          </tbody>
        </table>

        <div className="table-footer">
          <span>Mostrando <strong>{paged.length}</strong> de <strong>{filtered.length}</strong> expedientes</span>
          <div className="table-pager">
            <span style={{ fontSize: 12, color: '#64748b' }}>Página {currentPage} de {totalPages}</span>
            <div className="pagination subtle">
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Página anterior">‹</button>
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Página siguiente">›</button>
            </div>
            <select className="input" style={{ padding: '3px 8px', fontSize: 12, width: 'auto' }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Tamaño de página">
              <option value={5}>5 por pág.</option>
              <option value={10}>10 por pág.</option>
              <option value={25}>25 por pág.</option>
              <option value={50}>50 por pág.</option>
            </select>
          </div>
        </div>
      </section>

      {detail && (() => {
        const status = statusOf(detail);
        const editable = status === 'PENDIENTE' || status === 'POR_CORREGIR';
        return (
          <div className="modal-backdrop" onClick={() => setDetail(null)}>
            <div className="modal-panel" style={{ width: 'min(720px, 96%)', maxHeight: 'min(90vh, 900px)' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title-block">
                  <h2>Expediente de servicio automotriz</h2>
                  <p>Expediente #{detail.id} &bull; {detail.nombreNegocio}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`status-pill ${STATUS_META[status].pill}`}>{STATUS_META[status].label}</span>
                  <button className="icon-button" type="button" onClick={() => setDetail(null)} aria-label="Cerrar"><UiIcon name="close" /></button>
                </div>
              </div>

              <div style={{ padding: 20, display: 'grid', gap: 18 }}>
                {detail.notasRevision && (
                  <div className="ad-appeal-banner">
                    <UiIcon name="alert" />
                    <div>
                      <strong style={{ display: 'block', fontSize: 13.5, marginBottom: 2 }}>Última observación registrada:</strong>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{detail.notasRevision}</p>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  <div className="ad-modal-detail-card">
                    <h4><UiIcon name="store" /> Datos del negocio</h4>
                    <dl className="ad-modal-detail-list">
                      <div className="ad-modal-detail-row"><dt>Nombre:</dt><dd>{detail.nombreNegocio}</dd></div>
                      <div className="ad-modal-detail-row"><dt>RUT:</dt><dd>{detail.rutNegocio || 'No informado'}</dd></div>
                      <div className="ad-modal-detail-row"><dt>Giro:</dt><dd>{detail.giro || 'No informado'}</dd></div>
                      <div className="ad-modal-detail-row"><dt>Responsable:</dt><dd>{detail.responsable || 'No informado'}</dd></div>
                      <div className="ad-modal-detail-row"><dt>Dirección:</dt><dd>{detail.direccion || 'No informada'}</dd></div>
                      <div className="ad-modal-detail-row"><dt>Comuna / Región:</dt><dd>{detail.comuna || '—'}, {detail.region || 'Chile'}</dd></div>
                    </dl>
                  </div>
                  <div className="ad-modal-detail-card">
                    <h4><UiIcon name="user" /> Solicitante</h4>
                    <dl className="ad-modal-detail-list">
                      <div className="ad-modal-detail-row"><dt>Nombre:</dt><dd>{detail.usuarioNombre}</dd></div>
                      <div className="ad-modal-detail-row"><dt>Rol:</dt><dd>{detail.usuarioRol}</dd></div>
                      <div className="ad-modal-detail-row"><dt>Correo:</dt><dd>{detail.usuarioEmail}</dd></div>
                      <div className="ad-modal-detail-row"><dt>Captador:</dt><dd>{detail.captadorAlias ? `@${detail.captadorAlias}` : 'Postulación directa'}</dd></div>
                      <div className="ad-modal-detail-row"><dt>Enviado:</dt><dd>{formatDate(detail.submittedAt)}</dd></div>
                    </dl>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UiIcon name="document" /> Documentación legal
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    {DOCUMENTS.map((d) => {
                      const name = docName(detail, d.field);
                      return (
                        <div key={d.tipo} style={{ display: 'grid', gap: 6, padding: 12, borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12 }}>
                          <strong style={{ color: '#334155' }}>{d.label}</strong>
                          <span style={{ color: name ? '#16a34a' : '#94a3b8' }}>{name || 'No cargado'}</span>
                          {name && (
                            <button className="secondary-button" type="button" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => void api.downloadServiceDocument(detail.id, d.tipo, name)}>
                              <UiIcon name="download" style={{ width: 13, height: 13 }} /> Ver documento
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                <button className="secondary-button" type="button" onClick={() => setDetail(null)}>Cerrar</button>
                {editable && (
                  <>
                    <button className="secondary-button" type="button" style={{ color: '#d97706', borderColor: '#fed7aa' }} onClick={() => { const t = detail; setDetail(null); openDecision(t, 'request-correction'); }}>
                      <UiIcon name="refresh" style={{ width: 15, height: 15 }} /> Solicitar corrección
                    </button>
                    <button className="secondary-button" type="button" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => { const t = detail; setDetail(null); openDecision(t, 'reject'); }}>
                      <UiIcon name="shieldX" style={{ width: 15, height: 15 }} /> Rechazar
                    </button>
                    <button className="primary-button" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: detail.id, action: 'approve' })}>
                      <UiIcon name="check" style={{ width: 16, height: 16 }} /> Aprobar acreditación
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {decision && (
        <div className="modal-backdrop" onClick={() => setDecision(null)}>
          <div className="modal-panel" style={{ width: 'min(560px, 95%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-block">
                <h2 style={{ color: decision.action === 'reject' ? '#b91c1c' : '#b45309' }}>
                  {decision.action === 'reject' ? 'Rechazar expediente' : 'Solicitar corrección'}
                </h2>
                <p>Expediente #{decision.target.id} &bull; {decision.target.nombreNegocio}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setDecision(null)} aria-label="Cerrar"><UiIcon name="close" /></button>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 16 }}>
              <div style={{ padding: '12px 14px', background: decision.action === 'reject' ? '#fef2f2' : '#fffbeb', border: `1px solid ${decision.action === 'reject' ? '#fee2e2' : '#fde68a'}`, borderRadius: 8, color: decision.action === 'reject' ? '#991b1b' : '#92400e', fontSize: 12.5, lineHeight: 1.45 }}>
                {decision.action === 'reject'
                  ? 'El expediente quedará rechazado y el solicitante recibirá el motivo registrado.'
                  : 'El solicitante recibirá estas observaciones y podrá reenviar la documentación corregida.'}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                  {decision.action === 'reject' ? 'Motivo del rechazo:' : 'Observaciones o correcciones solicitadas:'}
                </label>
                <textarea className="input" rows={4} style={{ width: '100%', resize: 'vertical' }} placeholder="Detalla qué debe corregir el solicitante…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="secondary-button" type="button" onClick={() => setDecision(null)} disabled={mutation.isPending}>Cancelar</button>
              <button
                className="primary-button"
                type="button"
                style={{ background: decision.action === 'reject' ? '#dc2626' : '#d97706', borderColor: decision.action === 'reject' ? '#b91c1c' : '#b45309' }}
                onClick={() => mutation.mutate({ id: decision.target.id, action: decision.action, notas: notes.trim() })}
                disabled={mutation.isPending || !notes.trim()}
              >
                {mutation.isPending ? 'Guardando…' : decision.action === 'reject' ? 'Confirmar rechazo' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
