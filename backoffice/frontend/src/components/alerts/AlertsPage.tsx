import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as alertsApi from '@/api/alerts';
import * as receiptsApi from '@/api/receipts';
import MetricCard from '@/components/shared/MetricCard';
import Badge from '@/components/shared/Badge';
import Pagination from '@/components/shared/Pagination';
import { formatDateTime } from '@/utils/formatters';
import { PAGE_SIZES } from '@/utils/constants';
import { AlertSeverity } from '@/types/alert';
import { showToast } from '@/components/layout/Toast';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';

export default function AlertsPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<AlertSeverity | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', search, severity, page],
    queryFn: () => alertsApi.getAlerts(search || undefined, severity, page, PAGE_SIZES.ALERTS),
  });

  const { data: receipts } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => receiptsApi.getReceipts(0, PAGE_SIZES.RECEIPTS),
  });

  const resolveReceiptMutation = useMutation({
    mutationFn: (id: number) => receiptsApi.resolveReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      showToast('Boleta resuelta');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (id: number) => alertsApi.markAsReviewed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      showToast('Alerta revisada');
    },
  });

  const escalateMutation = useMutation({
    mutationFn: (id: number) => alertsApi.escalateToMediation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      showToast('Escalado a mediación');
    },
  });

  const alerts = data?.content ?? [];
  const selectedAlert = alerts.find((a) => a.id === selectedId);

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Alertas</h1>
          <p>Monitoreo de señales de riesgo y alertas del sistema</p>
        </div>
        <div className="header-actions">
          <input
            type="search"
            className="input"
            placeholder="Buscar alerta..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
          <select
            className="select"
            value={severity ?? ''}
            onChange={(e) => { setSeverity(e.target.value as AlertSeverity || undefined); setPage(0); }}
          >
            <option value="">Todas las severidades</option>
            <option value="CRITICA">Crítica</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
          </select>
          <AreaHomeShortcut />
        </div>
      </div>

      <div className="metric-grid compact">
        <MetricCard label="Críticas" value={alerts.filter((a) => a.severity === AlertSeverity.CRITICA).length} tone="red" />
        <MetricCard label="Alta" value={alerts.filter((a) => a.severity === AlertSeverity.ALTA).length} tone="amber" />
        <MetricCard label="Media" value={alerts.filter((a) => a.severity === AlertSeverity.MEDIA).length} tone="blue" />
      </div>

      <div className="alert-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Señales de Riesgo</h2>
            <span className="panel-count">{data?.totalElements ?? 0}</span>
          </div>

          {isLoading ? (
            <div className="panel-body">Cargando alertas...</div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Severidad</th>
                      <th>Vendedor</th>
                      <th>Señal</th>
                      <th>Evidencia</th>
                      <th>Acción</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr key={alert.id} className={selectedId === alert.id ? 'is-active' : ''} onClick={() => setSelectedId(alert.id)} style={{ cursor: 'pointer' }}>
                        <td><Badge text={alert.severity} variant={alert.severity} /></td>
                        <td>{alert.sellerName}</td>
                        <td>{alert.signalType}</td>
                        <td>{alert.evidence}</td>
                        <td>{alert.action}</td>
                        <td>{formatDateTime(alert.createdAt)}</td>
                        <td>
                          <div className="seller-actions">
                            {!alert.reviewed && (
                              <button className="row-action" onClick={(e) => { e.stopPropagation(); reviewMutation.mutate(alert.id); }} title="Marcar revisada">
                                <span className="ui-icon"><svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg></span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={page}
                totalPages={data?.totalPages ?? 0}
                totalItems={data?.totalElements ?? 0}
                pageSize={PAGE_SIZES.ALERTS}
                onPageChange={setPage}
              />
            </>
          )}
        </div>

        {selectedAlert && (
          <div className="side-panel">
            <div className="side-panel-head">
              <div>
                <h2>{selectedAlert.signalType}</h2>
                <p>{selectedAlert.sellerName}</p>
              </div>
              <Badge text={selectedAlert.severity} variant={selectedAlert.severity} />
            </div>

            <div className="side-section">
              <div className="detail-row"><span className="detail-label">Evidencia</span><span className="detail-value">{selectedAlert.evidence}</span></div>
              <div className="detail-row"><span className="detail-label">Impacto</span><span className="detail-value">{selectedAlert.impact}</span></div>
              <div className="detail-row"><span className="detail-label">Acción Recomendada</span><span className="detail-value">{selectedAlert.action}</span></div>
              <div className="detail-row"><span className="detail-label">Revisada</span><span className="detail-value">{selectedAlert.reviewed ? 'Sí' : 'No'}</span></div>
              <div className="detail-row"><span className="detail-label">Fecha</span><span className="detail-value">{formatDateTime(selectedAlert.createdAt)}</span></div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {!selectedAlert.reviewed && (
                <>
                  <button className="primary-button" onClick={() => reviewMutation.mutate(selectedAlert.id)}>
                    Marcar como Revisada
                  </button>
                  <button className="secondary-button" onClick={() => escalateMutation.mutate(selectedAlert.id)}>
                    Escalar a Mediación
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="panel panel-spaced">
        <div className="panel-header">
          <h2>Seguimiento de Boletas</h2>
          <span className="panel-count">{receipts?.totalElements ?? 0}</span>
        </div>
        <div className="panel-body">
          {receipts?.content && receipts.content.length > 0 ? (
            <div className="receipt-list">
              {receipts.content.map((r) => (
                <div key={r.id} className="receipt-item">
                  <div>
                    <strong>{r.sellerName}</strong>
                    <span>Orden {r.orderId} · {r.dueInfo}</span>
                    {r.detail && <p>{r.detail}</p>}
                  </div>
                  <div style={{ display: 'grid', gap: 6, alignItems: 'center' }}>
                    <Badge text={r.status} variant={r.status} />
                    {r.status !== 'RESUELTO' && (
                      <button className="secondary-button" style={{ fontSize: 11 }} onClick={() => resolveReceiptMutation.mutate(r.id)}>
                        Resolver
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Sin boletas pendientes.</p>
          )}
        </div>
      </div>
    </>
  );
}
