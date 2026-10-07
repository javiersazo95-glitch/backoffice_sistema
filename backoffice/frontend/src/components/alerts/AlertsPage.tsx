import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as alertsApi from '@/api/alerts';
import * as receiptsApi from '@/api/receipts';
import MetricCard from '@/components/shared/MetricCard';
import Badge from '@/components/shared/Badge';
import Pagination from '@/components/shared/Pagination';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { refundStatusView } from '@/utils/mediationResolution';
import RefundSupportActions from '@/components/shared/RefundSupportActions';
import { PAGE_SIZES } from '@/utils/constants';
import { AlertSeverity } from '@/types/alert';
import { showToast } from '@/components/layout/Toast';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import FounderSellerName from '@/components/shared/FounderSellerName';
import UiIcon from '@/components/shared/UiIcon';
import { useIsMobile } from '@/hooks/useIsMobile';
import { RecordCard, RecordList, EmptyState, DetailHost } from '@/components/mobile';

const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'default'> = {
  CRITICA: 'danger',
  ALTA: 'warning',
};

export default function AlertsPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<AlertSeverity | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

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
  // O74 (pruebas de lanzamiento, 27-sep): una alerta ya revisada sigue en la lista (atenuada y con su
  // distintivo) pero no cuenta como pendiente: antes "Alta 1" y "Señales de Riesgo 1" seguian en 1
  // despues de marcarla. El backend no filtra por estado, asi que se separa aqui (sobre la pagina).
  const pendingAlerts = alerts.filter((a) => !a.reviewed);

  const detailPanel = selectedAlert ? (
    <div className="side-panel">
      <div className="side-panel-head">
        <div>
          <h2>{selectedAlert.signalType}</h2>
          <p><FounderSellerName name={selectedAlert.sellerName} founder={selectedAlert.sellerFounder} /></p>
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

      {/* Pruebas de lanzamiento, 25-sep: alerta de un reembolso fallido o rechazado en Flow.
          Reintentar o marcar la devolucion manual cierra la alerta en el backend. */}
      {selectedAlert.refundPayment ? (
        <div className="side-section" style={{ display: 'grid', gap: 8 }}>
          <div className="detail-row">
            <span className="detail-label">Reembolso</span>
            <span className="detail-value">
              {selectedAlert.refundPayment.orderCode ?? '—'} · {formatCurrency(selectedAlert.refundPayment.amount ?? 0)}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Estado</span>
            <span className="detail-value">
              {selectedAlert.refundPayment.manual
                ? 'Devuelto manualmente por soporte'
                : refundStatusView(selectedAlert.refundPayment.status).label}
            </span>
          </div>
          <RefundSupportActions refund={selectedAlert.refundPayment} />
        </div>
      ) : null}

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
  ) : null;

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
        <MetricCard label="Críticas" value={pendingAlerts.filter((a) => a.severity === AlertSeverity.CRITICA).length} tone="red" />
        <MetricCard label="Alta" value={pendingAlerts.filter((a) => a.severity === AlertSeverity.ALTA).length} tone="amber" />
        <MetricCard label="Media" value={pendingAlerts.filter((a) => a.severity === AlertSeverity.MEDIA).length} tone="blue" />
      </div>

      <div className="alert-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Señales de Riesgo</h2>
            <span className="panel-count" title="Alertas pendientes de revisar">{pendingAlerts.length}</span>
          </div>

          {isLoading ? (
            <div className="panel-body">Cargando alertas...</div>
          ) : isMobile ? (
            <>
              <RecordList
                ariaLabel="Señales de riesgo"
                empty={<EmptyState icon="alert" title="Sin alertas" description="No hay señales de riesgo con estos filtros." />}
              >
                {alerts.map((alert) => (
                  <RecordCard
                    key={alert.id}
                    title={alert.signalType}
                    subtitle={<FounderSellerName name={alert.sellerName} founder={alert.sellerFounder} />}
                    badge={(
                      <>
                        <Badge text={alert.severity} variant={alert.severity} />
                        {alert.reviewed && <Badge text="Revisada" variant="green" />}
                      </>
                    )}
                    tone={alert.reviewed ? 'muted' : (SEVERITY_TONE[alert.severity] ?? 'default')}
                    meta={[
                      { label: 'Fecha', value: formatDateTime(alert.createdAt) },
                      { label: 'Acción', value: alert.action },
                      { label: 'Evidencia', value: alert.evidence, wide: true },
                    ]}
                    selected={selectedId === alert.id}
                    onPress={() => setSelectedId(alert.id)}
                    actions={!alert.reviewed ? (
                      <button type="button" className="mb-action mb-action--success" onClick={() => reviewMutation.mutate(alert.id)} disabled={reviewMutation.isPending}>
                        <UiIcon name="check" />
                        Marcar revisada
                      </button>
                    ) : undefined}
                  />
                ))}
              </RecordList>
              <Pagination
                currentPage={page}
                totalPages={data?.totalPages ?? 0}
                totalItems={data?.totalElements ?? 0}
                pageSize={PAGE_SIZES.ALERTS}
                onPageChange={setPage}
              />
            </>
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
                      <tr key={alert.id} className={selectedId === alert.id ? 'is-active' : ''} onClick={() => setSelectedId(alert.id)} style={{ cursor: 'pointer', opacity: alert.reviewed ? 0.55 : undefined }}>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            <Badge text={alert.severity} variant={alert.severity} />
                            {alert.reviewed && <Badge text="Revisada" variant="green" />}
                          </div>
                        </td>
                        <td><FounderSellerName name={alert.sellerName} founder={alert.sellerFounder} /></td>
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
          <DetailHost
            open
            onClose={() => setSelectedId(null)}
            title={selectedAlert.signalType}
            subtitle={selectedAlert.sellerName}
            id="mb-alert-detail"
          >
            {detailPanel}
          </DetailHost>
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
                    <strong><FounderSellerName name={r.sellerName} founder={r.sellerFounder} /></strong>
                    <span>Orden {r.orderId} · {r.dueInformation}</span>
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
