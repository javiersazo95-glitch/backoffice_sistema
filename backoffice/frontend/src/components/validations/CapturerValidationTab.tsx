import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/capturers';
import { resolveProfileImageUrl } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types/auth';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import type { CapturerConfig, CapturerProfile, CapturerStatus } from '@/types/capturer';

type StatusFilter = 'TODOS' | CapturerStatus;

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio',
  '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

const REJECT_REASON_PRESETS = [
  'Documentación o datos personales incompletos o ilegibles.',
  'El RUT informado no coincide con la identidad declarada.',
  'La zona o comuna solicitada ya cuenta con cobertura de captadores.',
  'No cumple con el perfil o los requisitos del programa de captadores.',
  'Antecedentes o referencias no verificables.',
  'Otro motivo específico...',
];

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  const d = new Date(value);
  return isNaN(d.getTime()) ? 'Sin fecha' : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function CapturerAvatar({ nombre, fotoPerfil, size = 34 }: { nombre: string; fotoPerfil?: string | null; size?: number }) {
  const url = resolveProfileImageUrl(fotoPerfil);
  const initials = nombre.trim().slice(0, 2).toUpperCase();
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'inline-grid',
        placeItems: 'center',
        overflow: 'hidden',
        background: '#1e40af',
        color: '#fff',
        fontSize: size * 0.36,
        fontWeight: 800,
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        initials
      )}
    </span>
  );
}

const STATUS_META: Record<CapturerStatus, { label: string; pill: string; icon: string }> = {
  PENDIENTE: { label: 'Pendiente', pill: 'tone-amber', icon: 'clock' },
  APROBADO: { label: 'Aprobado', pill: 'tone-green', icon: 'check' },
  RECHAZADO: { label: 'Rechazado', pill: 'tone-red', icon: 'shieldX' },
};

export default function CapturerValidationTab() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<CapturerProfile | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CapturerProfile | null>(null);
  const [rejectPreset, setRejectPreset] = useState(REJECT_REASON_PRESETS[0] || '');
  const [rejectNotes, setRejectNotes] = useState('');

  const [config, setConfig] = useState<CapturerConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(true);
  const [savedConfig, setSavedConfig] = useState<CapturerConfig | null>(null);

  const query = useQuery({ queryKey: ['capturer-validations'], queryFn: api.listCapturers });
  const configQuery = useQuery({
    queryKey: ['capturer-config'],
    queryFn: api.getCapturerConfig,
    enabled: user?.role === Role.SUPER_ADMIN,
  });
  useEffect(() => { if (configQuery.data) setConfig(configQuery.data); }, [configQuery.data]);

  const capturers = query.data ?? [];

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.approveCapturer(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['capturer-validations'] });
      showToast(`✓ Captador #${id} aprobado. Ya puede operar en la plataforma.`);
      setDetail(null);
    },
    onError: () => showToast('Error al aprobar el captador.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) => api.rejectCapturer(id, motivo),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['capturer-validations'] });
      showToast(`Captador #${id} rechazado. El motivo quedó registrado.`);
      setRejectTarget(null);
      setDetail(null);
      setRejectNotes('');
    },
    onError: () => showToast('Error al rechazar el captador.'),
  });

  const configMutation = useMutation({
    mutationFn: api.saveCapturerConfig,
    onSuccess: (data) => {
      setConfig(data);
      qc.invalidateQueries({ queryKey: ['capturer-config'] });
      qc.invalidateQueries({ queryKey: ['capturer-program-config'] });
      showToast('✓ Configuración de puntaje y comisiones guardada.');
      setSavedConfig(data);
    },
    onError: () => showToast('No se pudo guardar la configuración.'),
  });

  const yearOptions = useMemo(() => {
    const years = new Set<string>([String(new Date().getFullYear())]);
    capturers.forEach((c) => { if (c.createdAt) years.add(c.createdAt.slice(0, 4)); });
    return ['ALL', ...Array.from(years).sort().reverse()];
  }, [capturers]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    capturers.forEach((c) => {
      if (!c.createdAt) return;
      if (selectedYear !== 'ALL' && !c.createdAt.startsWith(selectedYear)) return;
      const m = c.createdAt.slice(5, 7);
      if (MONTH_NAMES[m]) months.add(m);
    });
    return [{ value: 'ALL', label: 'Todos los meses' }, ...Array.from(months).sort().map((m) => ({ value: m, label: MONTH_NAMES[m] as string }))];
  }, [capturers, selectedYear]);

  const metrics = useMemo(() => ({
    total: capturers.length,
    pendientes: capturers.filter((c) => c.estado === 'PENDIENTE').length,
    aprobados: capturers.filter((c) => c.estado === 'APROBADO').length,
    rechazados: capturers.filter((c) => c.estado === 'RECHAZADO').length,
  }), [capturers]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return capturers.filter((c) => {
      if (statusFilter !== 'TODOS' && c.estado !== statusFilter) return false;
      if (c.createdAt) {
        if (selectedYear !== 'ALL' && !c.createdAt.startsWith(selectedYear)) return false;
        if (selectedMonth !== 'ALL' && c.createdAt.slice(5, 7) !== selectedMonth) return false;
      } else if (selectedYear !== 'ALL' || selectedMonth !== 'ALL') {
        return false;
      }
      if (!term) return true;
      return (
        c.nombre.toLowerCase().includes(term) ||
        c.alias.toLowerCase().includes(term) ||
        c.rut.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.telefono || '').toLowerCase().includes(term) ||
        (c.comuna || '').toLowerCase().includes(term) ||
        (c.region || '').toLowerCase().includes(term) ||
        String(c.id).includes(term)
      );
    });
  }, [capturers, searchTerm, statusFilter, selectedMonth, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const openReject = (c: CapturerProfile) => {
    setRejectTarget(c);
    setRejectPreset(REJECT_REASON_PRESETS[0] || '');
    setRejectNotes('');
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    const base = rejectPreset === 'Otro motivo específico...' ? '' : rejectPreset;
    const motivo = rejectNotes.trim()
      ? (base ? `${base} - ${rejectNotes.trim()}` : rejectNotes.trim())
      : (base || 'Solicitud rechazada por el equipo de validación.');
    rejectMutation.mutate({ id: rejectTarget.id, motivo });
  };

  const exportCsv = () => {
    if (!filtered.length) { showToast('No hay captadores para exportar con los filtros actuales.'); return; }
    const headers = ['ID', 'Nombre', 'Alias', 'RUT', 'Email', 'Teléfono', 'Comuna', 'Región', 'Estado', 'Motivo rechazo', 'Registrado'];
    const rows = filtered.map((c) => [
      c.id, c.nombre, `@${c.alias}`, c.rut, c.email, c.telefono || '', c.comuna || '', c.region || '',
      c.estado, c.motivoRechazo || '', c.createdAt || '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`));
    const csv = 'data:text/csv;charset=utf-8,﻿' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `registros-captadores-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="ad-validation-workspace">
      <div className="metric-grid compact publicidad-metric-grid">
        <div className="metric-card">
          <div className="metric-icon blue"><UiIcon name="users" /></div>
          <div><h3>Total captadores</h3><strong>{metrics.total}</strong><p className="metric-description">Postulaciones recibidas</p></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon amber"><UiIcon name="clock" /></div>
          <div><h3>Pendientes de revisión</h3><strong>{metrics.pendientes}</strong><p className="metric-description">Por aprobar o rechazar</p></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon green"><UiIcon name="check" /></div>
          <div><h3>Aprobados</h3><strong>{metrics.aprobados}</strong><p className="metric-description">Operando en la plataforma</p></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon red"><UiIcon name="shieldX" /></div>
          <div><h3>Rechazados</h3><strong>{metrics.rechazados}</strong><p className="metric-description">Con motivo informado</p></div>
        </div>
      </div>

      <div className="notice">
        <p>
          <UiIcon name="info" />
          <span>
            Panel de validación de <strong>postulaciones de captadores</strong>. Revisa los datos de cada solicitante, aprueba a quienes cumplen el perfil o registra el motivo de rechazo para que el postulante pueda corregir y volver a postular.
          </span>
        </p>
      </div>

      {config && (
        <section className="table-shell" style={{ borderTop: '3px solid var(--blue, #2563eb)' }}>
          <div
            className="table-toolbar"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}
            onClick={() => setConfigOpen((v) => !v)}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#1e293b' }}>
              <UiIcon name="settings" /> Puntaje y comisiones del programa
            </span>
            <button type="button" className="icon-button" aria-label={configOpen ? 'Colapsar' : 'Expandir'}>
              <UiIcon name="chevronDown" style={configOpen ? { transform: 'rotate(180deg)' } : undefined} />
            </button>
          </div>
          {configOpen && (
            <div style={{ padding: '16px 18px', display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {([
                  ['puntosCasaAprobada', 'Puntos por casa', 1],
                  ['puntosServicioPrimeraCompra', 'Puntos primer pago', 1],
                  ['pesosPorPunto', 'Pesos por punto', 1],
                  ['comisionCasa', 'Comisión casa', 0.01],
                  ['comisionPublicidad', 'Comisión publicidad', 0.01],
                  ['comisionComprador', 'Comisión compradores', 0.001],
                  ['puntosCompradorConvertido', 'Puntos por comprador', 1],
                ] as const).map(([key, label, step]) => (
                  <label key={key} style={{ display: 'grid', gap: 5, fontSize: 12.5, fontWeight: 650, color: '#334155' }}>
                    {label}
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max={key.startsWith('comision') ? 1 : undefined}
                      step={step}
                      value={config[key] ?? 0}
                      onChange={(e) => setConfig((v) => (v ? { ...v, [key]: Number(e.target.value) } : v))}
                    />
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  className="primary-button"
                  type="button"
                  disabled={configMutation.isPending}
                  onClick={() => config && configMutation.mutate(config)}
                >
                  {configMutation.isPending ? 'Guardando…' : 'Guardar configuración'}
                </button>
                <span style={{ fontSize: 12, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <UiIcon name="info" style={{ width: 14, height: 14 }} />
                  Al guardar se actualizan las tarjetas informativas del portal de los captadores.
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="table-shell">
        <div className="table-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap' }}>
          <input
            className="input"
            type="search"
            placeholder="Buscar por nombre, alias, RUT, correo, comuna…"
            style={{ flex: 1, minWidth: 220 }}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />

          <div className="caja-filter-buttons" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button type="button" className={statusFilter === 'TODOS' ? 'primary-button' : 'secondary-button'} onClick={() => { setStatusFilter('TODOS'); setPage(1); }}>Todos ({metrics.total})</button>
            <button type="button" className={statusFilter === 'PENDIENTE' ? 'primary-button' : 'secondary-button'} onClick={() => { setStatusFilter('PENDIENTE'); setPage(1); }}>Pendientes ({metrics.pendientes})</button>
            <button type="button" className={statusFilter === 'APROBADO' ? 'primary-button' : 'secondary-button'} onClick={() => { setStatusFilter('APROBADO'); setPage(1); }}>Aprobados ({metrics.aprobados})</button>
            <button type="button" className={statusFilter === 'RECHAZADO' ? 'primary-button' : 'secondary-button'} onClick={() => { setStatusFilter('RECHAZADO'); setPage(1); }}>Rechazados ({metrics.rechazados})</button>
          </div>

          <select className="input" style={{ width: 'auto', flexShrink: 0 }} value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setPage(1); }} aria-label="Filtrar por mes">
            {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select className="input" style={{ width: 'auto', flexShrink: 0 }} value={selectedYear} onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }} aria-label="Filtrar por año">
            {yearOptions.map((y) => <option key={y} value={y}>{y === 'ALL' ? 'Todos los años' : y}</option>)}
          </select>

          <button className="icon-button" style={{ flexShrink: 0 }} type="button" onClick={exportCsv} title="Exportar CSV de captadores" aria-label="Exportar CSV de captadores">
            <UiIcon name="download" />
          </button>
        </div>

        <table className="wide-table">
          <thead>
            <tr>
              <th>Captador</th>
              <th>Contacto</th>
              <th>Ubicación</th>
              <th>Referido</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th>Registrado</th>
              <th style={{ width: 120, textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td colSpan={7}><div className="empty-state">Cargando solicitudes de captadores…</div></td></tr>
            ) : query.isError ? (
              <tr><td colSpan={7}><div className="empty-state error">Error al cargar las solicitudes de captadores.</div></td></tr>
            ) : paged.length > 0 ? (
              paged.map((c) => {
                const meta = STATUS_META[c.estado];
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CapturerAvatar nombre={c.nombre} fotoPerfil={c.fotoPerfil} />
                        <div className="ad-table-title-cell">
                          <div className="ad-table-title-main">{c.nombre}</div>
                          <div className="ad-table-title-sub" style={{ color: '#2563eb', fontWeight: 600 }}>@{c.alias} · {c.rut}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, color: '#334155' }}>{c.email}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{c.telefono || 'Sin teléfono'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{c.comuna || '—'}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{c.region || 'Chile'}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: c.codigoReferido ? '#0284c7' : '#94a3b8', fontWeight: 600 }}>
                        {c.codigoReferido || 'Directo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`status-pill ${meta.pill}`}
                        style={{ gap: 5, cursor: c.motivoRechazo ? 'help' : 'default' }}
                        title={c.motivoRechazo ? `Motivo: ${c.motivoRechazo}` : undefined}
                      >
                        <UiIcon name={meta.icon} style={{ width: 13, height: 13 }} />
                        {meta.label}
                      </span>
                    </td>
                    <td><div style={{ fontSize: 12, color: '#334155' }}>{formatDate(c.createdAt)}</div></td>
                    <td>
                      <div className="action-cell" style={{ justifyContent: 'center' }}>
                        <button className="action-button issue" type="button" onClick={() => setDetail(c)} title="Ver ficha completa">
                          <UiIcon name="eye" />
                        </button>
                        {c.estado !== 'APROBADO' && (
                          <button className="action-button success" type="button" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(c.id)} title="Aprobar captador">
                            <UiIcon name="check" />
                          </button>
                        )}
                        {c.estado !== 'RECHAZADO' && (
                          <button className="action-button delete" type="button" disabled={rejectMutation.isPending} onClick={() => openReject(c)} title="Rechazar captador">
                            <UiIcon name="shieldX" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={7}><div className="empty-state">No se encontraron captadores con los filtros aplicados.</div></td></tr>
            )}
          </tbody>
        </table>

        <div className="table-footer">
          <span>Mostrando <strong>{paged.length}</strong> de <strong>{filtered.length}</strong> captadores</span>
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

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal-panel" style={{ width: 'min(620px, 96%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-block" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CapturerAvatar nombre={detail.nombre} fotoPerfil={detail.fotoPerfil} size={44} />
                <div>
                  <h2>{detail.nombre}</h2>
                  <p>Postulación #{detail.id} &bull; @{detail.alias}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`status-pill ${STATUS_META[detail.estado].pill}`}>{STATUS_META[detail.estado].label}</span>
                <button className="icon-button" type="button" onClick={() => setDetail(null)} aria-label="Cerrar"><UiIcon name="close" /></button>
              </div>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 18 }}>
              {detail.motivoRechazo && (
                <div className="ad-appeal-banner">
                  <UiIcon name="alert" />
                  <div>
                    <strong style={{ display: 'block', fontSize: 13.5, marginBottom: 2 }}>Motivo de rechazo registrado:</strong>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{detail.motivoRechazo}</p>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                <div className="ad-modal-detail-card">
                  <h4><UiIcon name="user" /> Datos personales</h4>
                  <dl className="ad-modal-detail-list">
                    <div className="ad-modal-detail-row"><dt>Nombre:</dt><dd>{detail.nombre}</dd></div>
                    <div className="ad-modal-detail-row"><dt>Alias:</dt><dd>@{detail.alias}</dd></div>
                    <div className="ad-modal-detail-row"><dt>RUT:</dt><dd>{detail.rut}</dd></div>
                    <div className="ad-modal-detail-row"><dt>Correo:</dt><dd>{detail.email}</dd></div>
                    <div className="ad-modal-detail-row"><dt>Teléfono:</dt><dd>{detail.telefono || 'No informado'}</dd></div>
                  </dl>
                </div>
                <div className="ad-modal-detail-card">
                  <h4><UiIcon name="target" /> Zona y programa</h4>
                  <dl className="ad-modal-detail-list">
                    <div className="ad-modal-detail-row"><dt>Comuna:</dt><dd>{detail.comuna || 'No informada'}</dd></div>
                    <div className="ad-modal-detail-row"><dt>Región:</dt><dd>{detail.region || 'No informada'}</dd></div>
                    <div className="ad-modal-detail-row"><dt>Código referido:</dt><dd>{detail.codigoReferido || 'Postulación directa'}</dd></div>
                    <div className="ad-modal-detail-row"><dt>Registrado:</dt><dd>{formatDate(detail.createdAt)}</dd></div>
                    <div className="ad-modal-detail-row"><dt>Ganancia del mes:</dt><dd>${Number(detail.gananciaMes || 0).toLocaleString('es-CL')}</dd></div>
                  </dl>
                </div>
              </div>

              <div className="ad-modal-detail-card">
                <h4><UiIcon name="document" /> Documentos de postulación</h4>
                <div style={{ display: 'grid', gap: 9 }}>
                  {([
                    ['antecedentes', 'Certificado de antecedentes', detail.antecedentesNombre],
                    ['carnet-frente', 'Carnet de identidad · frente', detail.carnetFrenteNombre],
                    ['carnet-reverso', 'Carnet de identidad · reverso', detail.carnetReversoNombre],
                  ] as const).map(([tipo, label, nombre]) => (
                    <div key={tipo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <div style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 13 }}>{label}</strong><span className="muted" style={{ overflowWrap: 'anywhere' }}>{nombre || 'No adjuntado'}</span></div>
                      {nombre && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button className="secondary-button" type="button" onClick={() => void api.viewCapturerDocument(detail.id, tipo).catch((error: unknown) => showToast(error instanceof Error ? error.message : `No se pudo ver ${label.toLowerCase()}.`))}>
                            <UiIcon name="eye" /> Ver
                          </button>
                          <button className="secondary-button" type="button" onClick={() => void api.downloadCapturerDocument(detail.id, tipo, nombre).catch(() => showToast(`No se pudo descargar ${label.toLowerCase()}.`))}>
                            <UiIcon name="download" /> Descargar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="secondary-button" type="button" onClick={() => setDetail(null)}>Cerrar</button>
              {detail.estado !== 'RECHAZADO' && (
                <button className="secondary-button" type="button" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => { const c = detail; setDetail(null); openReject(c); }}>
                  Rechazar
                </button>
              )}
              {detail.estado !== 'APROBADO' && (
                <button className="primary-button" type="button" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(detail.id)}>
                  <UiIcon name="check" style={{ width: 16, height: 16 }} /> Aprobar captador
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {savedConfig && (
        <div className="modal-backdrop" onClick={() => setSavedConfig(null)} style={{ zIndex: 90 }}>
          <div className="modal-panel" style={{ width: 'min(460px, 92%)', textAlign: 'center', padding: '28px 24px 22px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <UiIcon name="check" style={{ width: 32, height: 32 }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 750, color: '#0f172a', marginBottom: 8 }}>Configuración guardada</h3>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.55, marginBottom: 16 }}>
              El puntaje y las comisiones del programa se actualizaron. Las tarjetas informativas del portal de los captadores ya reflejan estos valores.
            </p>
            <div style={{ textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 6, fontSize: 12.5, color: '#334155', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Comisión por casa</span><strong>{(savedConfig.comisionCasa * 100).toLocaleString('es-CL')}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Comisión por publicidad</span><strong>{(savedConfig.comisionPublicidad * 100).toLocaleString('es-CL')}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Comisión por compras de compradores</span><strong>{((savedConfig.comisionComprador ?? 0.01) * 100).toLocaleString('es-CL')}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Puntos por comprador captado</span><strong>{(savedConfig.puntosCompradorConvertido ?? 2).toLocaleString('es-CL')}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Puntos por casa aprobada</span><strong>{savedConfig.puntosCasaAprobada.toLocaleString('es-CL')}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Puntos por primer pago de servicio</span><strong>{savedConfig.puntosServicioPrimeraCompra.toLocaleString('es-CL')}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pesos por punto</span><strong>${savedConfig.pesosPorPunto.toLocaleString('es-CL')}</strong></div>
            </div>
            <button className="primary-button" type="button" style={{ width: '100%' }} onClick={() => setSavedConfig(null)} autoFocus>Entendido</button>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="modal-backdrop" onClick={() => setRejectTarget(null)}>
          <div className="modal-panel" style={{ width: 'min(560px, 95%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-block">
                <h2 style={{ color: '#b91c1c' }}>Rechazar postulación de captador</h2>
                <p>Postulación #{rejectTarget.id} &bull; {rejectTarget.nombre}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setRejectTarget(null)} aria-label="Cerrar"><UiIcon name="close" /></button>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 16 }}>
              <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, color: '#991b1b', fontSize: 12.5, lineHeight: 1.45 }}>
                <strong>Importante:</strong> El postulante recibirá este motivo y podrá corregir sus datos para volver a postular.
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Causal común de rechazo:</label>
                <select className="input" style={{ width: '100%' }} value={rejectPreset} onChange={(e) => setRejectPreset(e.target.value)}>
                  {REJECT_REASON_PRESETS.map((p, i) => <option key={i} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Detalle adicional u observaciones:</label>
                <textarea className="input" rows={4} style={{ width: '100%', resize: 'vertical' }} placeholder="Explica qué debe corregir el postulante…" value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} />
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="secondary-button" type="button" onClick={() => setRejectTarget(null)} disabled={rejectMutation.isPending}>Cancelar</button>
              <button
                className="primary-button"
                type="button"
                style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                onClick={confirmReject}
                disabled={rejectMutation.isPending || (rejectPreset === 'Otro motivo específico...' && !rejectNotes.trim())}
              >
                <UiIcon name="shieldX" style={{ width: 16, height: 16 }} /> {rejectMutation.isPending ? 'Guardando…' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
