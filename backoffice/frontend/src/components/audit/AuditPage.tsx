import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as auditsApi from '@/api/audits';
import MetricCard from '@/components/shared/MetricCard';
import Badge from '@/components/shared/Badge';
import Pagination from '@/components/shared/Pagination';
import { formatDateTime } from '@/utils/formatters';
import { PAGE_SIZES } from '@/utils/constants';
import type { AuditFilterRequest } from '@/types/audit';
import { AuditModule } from '@/types/audit';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';

function formatPeriod(start: string, end: string): string {
  if (!start || !end) return 'Todo el periodo';
  return `${start} — ${end}`;
}

const periodPresets = [
  { label: 'Hoy', description: 'Registros del día actual', start: new Date().toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) },
  { label: 'Última Semana', description: 'Últimos 7 días', start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) },
  { label: 'Último Mes', description: 'Últimos 30 días', start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) },
  { label: 'Todo', description: 'Todos los registros', start: '', end: '' },
];

export default function AuditPage() {
  const [filter, setFilter] = useState<AuditFilterRequest>({ page: 0, size: PAGE_SIZES.AUDITS });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['audits', filter],
    queryFn: () => auditsApi.getAuditLogs(filter),
  });

  const { data: expandedLog } = useQuery({
    queryKey: ['audit', expandedId],
    queryFn: () => auditsApi.getAuditLogById(expandedId!),
    enabled: !!expandedId,
  });

  const logs = data?.content ?? [];

  const moduleBadgeVariant: Record<string, string> = {
    VENDEDORES: 'mediaciones',
    VALIDACIONES: 'en-proceso',
    MEDIACIONES: 'en-mediacion',
    ALERTAS: 'pendiente',
  };

  const renderState = (state: Record<string, string> | undefined, label: string) => {
    if (!state || Object.keys(state).length === 0) return <p style={{ color: 'var(--muted)', fontSize: 12 }}>Sin cambios registrados</p>;
    return (
      <div className="state-box">
        <span className="state-label">{label}</span>
        {Object.entries(state).map(([key, value]) => (
          <div key={key} className="state-detail">
            <span>{key}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Bitácora</h1>
          <p>Registro de auditoría de todas las acciones del sistema</p>
        </div>
        <div className="header-actions">
          <div className="current-date-pill">
            <span className="ui-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg></span>
            <strong>{formatPeriod(filter.startDate ?? '', filter.endDate ?? '')}</strong>
          </div>
          <AreaHomeShortcut />
        </div>
      </div>

      <div className="metric-grid compact audit-metric-grid">
        <MetricCard label="Total Registros" value={data?.totalElements ?? 0} tone="blue" />
        <MetricCard label="Vendedores" value={logs.filter((l) => l.module === AuditModule.VENDEDORES).length} tone="green" />
        <MetricCard label="Validaciones" value={logs.filter((l) => l.module === AuditModule.VALIDACIONES).length} tone="amber" />
        <MetricCard label="Mediaciones" value={logs.filter((l) => l.module === AuditModule.MEDIACIONES).length} tone="violet" />
        <MetricCard label="Alertas" value={logs.filter((l) => l.module === AuditModule.ALERTAS).length} tone="red" />
      </div>

      <div className="panel">
        <div className="audit-filter-bar">
          <input
            type="search"
            className="input"
            placeholder="Buscar en bitácora..."
            value={filter.search ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value, page: 0 }))}
          />
          <select
            className="select"
            value={filter.module ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, module: (e.target.value || undefined) as AuditModule | undefined, page: 0 }))}
          >
            <option value="">Módulo</option>
            <option value="VENDEDORES">Vendedores</option>
            <option value="VALIDACIONES">Validaciones</option>
            <option value="MEDIACIONES">Mediaciones</option>
            <option value="ALERTAS">Alertas</option>
          </select>
          <input
            type="date"
            className="input"
            value={filter.startDate ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, startDate: e.target.value || undefined, page: 0 }))}
          />
          <div className="floating-period-control">
            <button className="period-icon-button" onClick={() => setPeriodOpen(!periodOpen)}>
              <span className="ui-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg></span>
            </button>
            {periodOpen && (
              <div className="period-menu">
                <div className="period-menu-head">
                  <strong>Periodo</strong>
                  <span>Seleccione un rango predefinido</span>
                </div>
                {periodPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setFilter((f) => ({ ...f, startDate: preset.start || undefined, endDate: preset.end || undefined, page: 0 }));
                      setPeriodOpen(false);
                    }}
                  >
                    <span>{preset.label}</span>
                    <small>{preset.description}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="panel-body">Cargando bitácora...</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Fecha</th>
                    <th>Operador</th>
                    <th>Vendedor</th>
                    <th>Módulo</th>
                    <th>Acción</th>
                    <th>Detalle</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr key={log.id} className={expandedId === log.id ? 'is-active' : ''}>
                        <td>
                          <button
                            className={`expand-toggle${expandedId === log.id ? ' open' : ''}`}
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          >
                            <span className="ui-icon"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg></span>
                          </button>
                        </td>
                        <td>{formatDateTime(log.createdAt)}</td>
                        <td>{log.userFullName}</td>
                        <td>{log.sellerName}</td>
                        <td><Badge text={log.module} variant={moduleBadgeVariant[log.module] ?? ''} /></td>
                        <td>{log.action}</td>
                        <td>{log.detail}</td>
                        <td>{log.result}</td>
                      </tr>
                      {expandedId === log.id && expandedLog && (
                        <tr key={`${log.id}-detail`}>
                          <td colSpan={8} style={{ padding: 0, background: '#fbfdff' }}>
                            <div style={{ padding: 16 }}>
                              <div className="audit-detail-card">
                                <div className="audit-detail-hero">
                                  <div className="status-icon blue">
                                    <span className="ui-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></span>
                                  </div>
                                  <div className="audit-hero-copy">
                                    <span>AUDITORÍA DETALLE</span>
                                    <h2>{expandedLog.action}</h2>
                                    <p>{expandedLog.detail}</p>
                                  </div>
                                  <div className="audit-hero-status">
                                    <Badge text={expandedLog.result} variant={expandedLog.result === 'EXITOSO' ? 'APROBADO' : 'RECHAZADO'} />
                                    <small>IP: {expandedLog.ipAddress}</small>
                                  </div>
                                </div>

                                <div className="audit-detail-grid">
                                  <div className="audit-context-card">
                                    <div className="audit-section-head">
                                      <div className="status-icon blue mini-icon">
                                        <span className="ui-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg></span>
                                      </div>
                                      <div>
                                        <h3>Contexto</h3>
                                        <p>{expandedLog.userFullName} · {expandedLog.sellerName}</p>
                                      </div>
                                    </div>
                                    <div className="audit-context-meta">
                                      <span>Operador <strong>{expandedLog.userFullName}</strong></span>
                                      <span>Vendedor <strong>{expandedLog.sellerName}</strong></span>
                                      <span>RUT <strong>{expandedLog.sellerRut}</strong></span>
                                      <span>Módulo <strong>{expandedLog.module}</strong></span>
                                    </div>
                                  </div>

                                  <div className="audit-change-card">
                                    <div className="audit-section-head">
                                      <div className="status-icon amber mini-icon">
                                        <span className="ui-icon"><svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg></span>
                                      </div>
                                      <div>
                                        <h3>Cambios</h3>
                                        <p>Estado anterior y posterior</p>
                                      </div>
                                    </div>
                                    <div className="audit-state">
                                      {renderState(expandedLog.previousState, 'Estado Anterior')}
                                      <div className="arrow">
                                        <span className="ui-icon"><svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></span>
                                      </div>
                                      {renderState(expandedLog.nextState, 'Estado Posterior')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={filter.page ?? 0}
              totalPages={data?.totalPages ?? 0}
              totalItems={data?.totalElements ?? 0}
              pageSize={PAGE_SIZES.AUDITS}
              onPageChange={(p) => setFilter((f) => ({ ...f, page: p }))}
            />
          </>
        )}
      </div>
    </>
  );
}
