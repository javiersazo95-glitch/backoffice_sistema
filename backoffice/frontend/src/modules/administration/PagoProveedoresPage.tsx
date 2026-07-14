import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import * as adminApi from '@/api/administration';
import UiIcon from '@/components/shared/UiIcon';
import MetricCard from '@/components/shared/MetricCard';
import { downloadFile, csvCell } from './utils';
import type { RetiroAdminResponse, RetiroDetalleResponse, PagoProveedorResponse } from './types';

// Helper to calculate Thursday-to-Wednesday cycle range
function getCurrentCycleRange() {
  const today = new Date();
  const day = today.getDay(); // 0: Sunday, 3: Wednesday, 4: Thursday

  const start = new Date(today);
  const diffToThursday = day >= 4 ? day - 4 : day + 3;
  start.setDate(today.getDate() - diffToThursday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatDate(dateString: string | Date) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(dateString: string | Date) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMoney(amount: number) {
  return '$' + Math.round(amount).toLocaleString('es-CL');
}

export default function PagoProveedoresPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'gestion' | 'historial'>('gestion');
  const [isProcesarModalOpen, setIsProcesarModalOpen] = useState(false);
  const [processingBulk, setProcessingBulk] = useState(false);
  const [incompleteDocumentSellers, setIncompleteDocumentSellers] = useState<string[]>([]);

  // Filters for History Tab
  const [historyCodeFilter, setHistoryCodeFilter] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  // Selected withdrawal for detail popup
  const [selectedPagoId, setSelectedPagoId] = useState<number | null>(null);
  const [selectedPendingRetiroId, setSelectedPendingRetiroId] = useState<number | null>(null);

  // Thursday to Wednesday range
  const { start: cycleStart, end: cycleEnd } = useMemo(() => getCurrentCycleRange(), []);

  // Fetch all withdrawals
  const { data: withdrawals = [], isLoading, refetch } = useQuery<RetiroAdminResponse[]>({
    queryKey: ['admin-withdrawals'],
    queryFn: adminApi.getWithdrawals,
  });

  const { data: payments = [] } = useQuery<PagoProveedorResponse[]>({
    queryKey: ['admin-withdrawal-payments'],
    queryFn: adminApi.getWithdrawalPayments,
  });

  const { data: paymentDetails } = useQuery<PagoProveedorResponse>({
    queryKey: ['admin-withdrawal-payment', selectedPagoId],
    queryFn: () => adminApi.getWithdrawalPayment(selectedPagoId!),
    enabled: selectedPagoId !== null,
  });

  const { data: pendingRetiroDetails } = useQuery<RetiroDetalleResponse>({
    queryKey: ['admin-withdrawal-details', selectedPendingRetiroId],
    queryFn: () => adminApi.getWithdrawalDetails(selectedPendingRetiroId!),
    enabled: selectedPendingRetiroId !== null,
  });

  // 1. Filter withdrawals for Tab 1 (Gestión de Pagos)
  // - Shows active requests (estado "SOLICITADO" or resolveEstado showing requested)
  // - Requested date must fall within the current weekly cycle (Thursday to Wednesday)
  const pendingWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      const isPending = w.estado === 'SOLICITADO';
      const createdDate = new Date(w.fecha);
      const isWithinCycle = createdDate <= cycleEnd;
      return isPending && isWithinCycle;
    });
  }, [withdrawals, cycleEnd]);

  const handleConfirmProcesarPago = async () => {
    setProcessingBulk(true);
    try {
      const refreshed = await refetch();
      const latestPendingWithdrawals = (refreshed.data ?? withdrawals).filter((withdrawal) => {
        const createdDate = new Date(withdrawal.fecha);
        return withdrawal.estado === 'SOLICITADO' && createdDate <= cycleEnd;
      });
      const incompleteSellers = latestPendingWithdrawals
        .filter((withdrawal) => !withdrawal.documentoLiquidacionCompleto)
        .map((withdrawal) => withdrawal.nombreTienda);
      if (incompleteSellers.length) {
        setIncompleteDocumentSellers([...new Set(incompleteSellers)]);
        setIsProcesarModalOpen(false);
        return;
      }

      await adminApi.createWithdrawalPayment(latestPendingWithdrawals.map((withdrawal) => withdrawal.retiroId));
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawal-payments'] });
      setIsProcesarModalOpen(false);
      setActiveTab('historial');
      alert('Todos los pagos del ciclo han sido procesados y conciliados con éxito.');
    } catch (err: unknown) {
      const message = isAxiosError(err) && typeof err.response?.data?.message === 'string'
        ? err.response.data.message
        : err instanceof Error ? err.message : 'No se pudieron procesar los pagos.';
      alert('Ocurrió un error al procesar los pagos: ' + message);
    } finally {
      setProcessingBulk(false);
    }
  };

  // 2. Filter withdrawals for Tab 2 (Historial de Pagos)
  // - Shows completed payouts (estado "PAGADO")
  // - Filterable by code and date
  const paidPayments = useMemo(() => payments.filter((payment) => {
    const code = `PAG-${String(payment.pagoId).padStart(6, '0')}`;
    const date = new Date(payment.fechaPago);
    return (!historyCodeFilter || code.toLowerCase().includes(historyCodeFilter.toLowerCase()))
      && (!historyStartDate || date >= new Date(historyStartDate + 'T00:00:00'))
      && (!historyEndDate || date <= new Date(historyEndDate + 'T23:59:59'));
  }), [payments, historyCodeFilter, historyStartDate, historyEndDate]);

  // Total sums
  const pendingTotalAmount = useMemo(() => pendingWithdrawals.reduce((sum, w) => sum + w.monto, 0), [pendingWithdrawals]);
  const paidTotalAmount = useMemo(() => paidPayments.reduce((sum, payment) => sum + payment.montoTotal, 0), [paidPayments]);

  // CSV/Excel Export (Gestión de Pagos)
  // Excludes: request ID (codigo de solicitud), date (fecha), and store name (nombre de la tienda)
  // Columns remaining: rut, razon social, banco, tipo de cuenta, numero de cuenta, monto, email
  const handleExportExcel = () => {
    if (pendingWithdrawals.length === 0) {
      alert('No hay solicitudes pendientes en el ciclo actual para exportar.');
      return;
    }

    const headers = [
      'RUT',
      'Razón Social',
      'Banco',
      'Tipo de Cuenta',
      'Número de Cuenta',
      'Monto',
      'Email'
    ];

    const rows = pendingWithdrawals.map((w) => [
      csvCell(w.rut),
      csvCell(w.razonSocial),
      csvCell(w.banco),
      csvCell(w.tipoCuenta),
      csvCell(w.numeroCuenta),
      w.monto,
      csvCell(w.email)
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const startStr = cycleStart.toISOString().slice(0, 10);
    const endStr = cycleEnd.toISOString().slice(0, 10);
    downloadFile(`pago-proveedores-ciclo-${startStr}-a-${endStr}.csv`, csvContent, 'text/csv;charset=utf-8');
  };

  return (
    <div className="admin-finance-page">
      <header className="page-header">
        <div className="header-title">
          <h1>Pago a proveedores</h1>
          <p>Gestión y conciliación de depósitos semanales a tiendas de repuestos.</p>
        </div>
        <div className="header-actions">
          {activeTab === 'gestion' ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsProcesarModalOpen(true)}
              disabled={pendingWithdrawals.length === 0}
              style={{
                background: 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)',
                borderColor: '#2e7d32',
                color: '#fff',
                fontWeight: 'bold',
                boxShadow: '0 4px 10px rgba(46, 125, 50, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              title="Procesar todos los retiros pendientes del ciclo actual"
            >
              <UiIcon name="check" /> Procesar pago
            </button>
          ) : (
            <button className="secondary-button" type="button" onClick={() => refetch()} title="Actualizar datos">
              <UiIcon name="refresh" /> Actualizar
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="module-tabs">
        <button className={activeTab === 'gestion' ? 'active' : ''} onClick={() => setActiveTab('gestion')}>
          <UiIcon name="wallet" /> Gestión de Pagos
        </button>
        <button className={activeTab === 'historial' ? 'active' : ''} onClick={() => setActiveTab('historial')}>
          <UiIcon name="clock" /> Historial de pagos
        </button>
      </div>

      {activeTab === 'gestion' ? (
        <>
          {/* Metrics Tab 1 */}
          <div className="metric-grid compact" style={{ marginBottom: '20px' }}>
            <MetricCard
              label="Total a pagar en ciclo"
              value={formatMoney(pendingTotalAmount)}
              tone="blue"
              description="Suma total de retiros solicitados"
              iconName="wallet"
            />
            <MetricCard
              label="Transferencias pendientes"
              value={pendingWithdrawals.length}
              tone="green"
              description="Tiendas esperando depósito"
              iconName="users"
            />
          </div>

          <div className="notice" style={{ marginBottom: '15px' }}>
            <UiIcon name="calendar" /> Ciclo de pagos actual: <strong>Jueves {formatDateShort(cycleStart)}</strong> al <strong>Miércoles {formatDateShort(cycleEnd)}</strong>. Mostrando retiros solicitados dentro de este rango.
          </div>

          {/* Table Tab 1 */}
          <section className="table-shell">
            <div className="table-toolbar">
              <h2>Solicitudes del ciclo</h2>
              <button className="primary-button" type="button" onClick={handleExportExcel} disabled={pendingWithdrawals.length === 0}>
                <UiIcon name="download" /> Exportar Excel
              </button>
            </div>
            
            <div className="table-wrap">
              <table className="wide-table">
                <thead>
                  <tr>
                    <th>Cód. Solicitud</th>
                    <th>Solicitudes de retiro / Tiendas</th>
                    <th>RUT</th>
                    <th>Razón Social</th>
                    <th>Banco</th>
                    <th>Tipo Cuenta</th>
                    <th>Nº Cuenta</th>
                    <th>Monto</th>
                    <th>Email</th>
                    <th>Fecha Solicitud</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={11} className="loading-cell">Cargando solicitudes de retiros...</td>
                    </tr>
                  ) : pendingWithdrawals.length > 0 ? (
                    pendingWithdrawals.map((w) => (
                      <tr key={w.retiroId}>
                        <td><strong>RET-{String(w.retiroId).padStart(6, '0')}</strong></td>
                        <td>{w.nombreTienda}</td>
                        <td>{w.rut}</td>
                        <td>{w.razonSocial}</td>
                        <td>{w.banco}</td>
                        <td>{w.tipoCuenta}</td>
                        <td>{w.numeroCuenta}</td>
                        <td style={{ fontWeight: 'bold' }}>{formatMoney(w.monto)}</td>
                        <td>{w.email}</td>
                        <td>{formatDate(w.fecha)}</td>
                        <td>
                          <div className="action-cell">
                            <button
                              className="action-button neutral"
                              type="button"
                              onClick={() => setSelectedPendingRetiroId(w.retiroId)}
                              title="Ver detalle de la solicitud de retiro"
                            >
                              <UiIcon name="eye" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11}>
                        <div className="empty-state">No hay solicitudes de retiros registradas para este ciclo.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Metrics Tab 2 */}
          <div className="metric-grid compact" style={{ marginBottom: '20px' }}>
            <MetricCard
              label="Total histórico pagado"
              value={formatMoney(paidTotalAmount)}
              tone="blue"
              description="Depósitos conciliados"
              iconName="wallet"
            />
            <MetricCard
              label="Transferencias conciliadas"
              value={paidPayments.length}
              tone="violet"
              description="Total transferencias ejecutadas"
              iconName="check"
            />
          </div>

          {/* Filters Tab 2 */}
          <section className="table-filters" style={{ marginBottom: '15px', padding: '15px', background: '#fff', borderRadius: '8px', border: '1px solid #dfe8f5', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '200px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#496079' }}>Código de Solicitud</label>
              <div className="search-box-container" style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Ej: PAG-000001"
                  value={historyCodeFilter}
                  onChange={(e) => setHistoryCodeFilter(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cddde9' }}
                />
              </div>
            </div>

            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '150px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#496079' }}>Fecha Pago Desde</label>
              <input
                type="date"
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cddde9' }}
              />
            </div>

            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '150px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#496079' }}>Fecha Pago Hasta</label>
              <input
                type="date"
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cddde9' }}
              />
            </div>

            <div className="filter-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setHistoryCodeFilter('');
                  setHistoryStartDate('');
                  setHistoryEndDate('');
                }}
                style={{ height: '38px' }}
              >
                Limpiar Filtros
              </button>
            </div>
          </section>

          {/* Table Tab 2 */}
          <section className="table-shell">
            <div className="table-toolbar">
              <h2>Historial de Pagos Conciliados</h2>
            </div>
            
            <div className="table-wrap">
              <table className="wide-table">
                <thead>
                  <tr>
                    <th>Cód. Solicitud</th>
                    <th>Tienda</th>
                    <th>Monto Pagado</th>
                    <th>Fecha de Solicitud</th>
                    <th>Estado</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="loading-cell">Cargando historial de pagos...</td>
                    </tr>
                  ) : paidPayments.length > 0 ? (
                    paidPayments.map((payment) => (
                      <tr key={payment.pagoId}>
                        <td>
                          <strong>PAG-{String(payment.pagoId).padStart(6, '0')}</strong>
                          <small style={{ display: 'block', color: '#6b7a90', marginTop: 3 }}>{payment.retiros.length} solicitudes de retiro</small>
                        </td>
                        <td>{payment.retiros.map((retiro) => retiro.nombreTienda).join(', ')}</td>
                        <td style={{ fontWeight: 'bold', color: '#2e7d32' }}>{formatMoney(payment.montoTotal)}</td>
                        <td>{formatDate(payment.fechaPago)}</td>
                        <td>
                          <span className="badge success" style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                            {payment.estado}
                          </span>
                        </td>
                        <td>
                          <div className="action-cell">
                            <button
                              className="action-button neutral"
                              type="button"
                              onClick={() => setSelectedPagoId(payment.pagoId)}
                              title="Ver detalle del pago"
                            >
                              <UiIcon name="eye" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">No se encontraron registros de pagos para los filtros seleccionados.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {selectedPendingRetiroId !== null && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedPendingRetiroId(null)}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: 12, width: '90%', maxWidth: 650, padding: 24 }} onClick={(event) => event.stopPropagation()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Solicitud de retiro RET-{String(selectedPendingRetiroId).padStart(6, '0')}</h3>
              <button type="button" onClick={() => setSelectedPendingRetiroId(null)} style={{ background: 'transparent', border: 0, fontSize: 20 }}>&times;</button>
            </header>
            {pendingRetiroDetails && (
              <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><strong>Fecha de solicitud:</strong> {formatDate(pendingRetiroDetails.fechaSolicitud)}</div>
                <div><strong>Monto solicitado:</strong> {formatMoney(pendingRetiroDetails.montoTotal)}</div>
                <div><strong>Pedidos incluidos:</strong> {pendingRetiroDetails.cantidadPedidos}</div>
                <div><strong>Estado:</strong> {pendingRetiroDetails.estado}</div>
                <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                  <strong>Desglose de pedidos:</strong>
                  <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <table className="payout-request-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 12px' }}>ID Pedido</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px' }}>Descripción</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px' }}>Fecha</th>
                          <th style={{ textAlign: 'center', padding: '8px 12px' }}>Cantidad</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px' }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingRetiroDetails.pedidos.map((pedido) => (
                          <tr key={pedido.pedidoId} style={{ borderTop: '1px solid #edf2f7' }}>
                            <td style={{ padding: '8px 12px' }}><strong>PED-{String(pedido.pedidoId).padStart(7, '0')}</strong></td>
                            <td style={{ padding: '8px 12px' }}>{pedido.nombrePedido}</td>
                            <td style={{ padding: '8px 12px' }}>{formatDateShort(pedido.fecha)}</td>
                            <td style={{ textAlign: 'center', padding: '8px 12px' }}>{pedido.cantidadVendida}</td>
                            <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700 }}>{formatMoney(pedido.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700 }}>
                    <span>Total de la solicitud:</span>
                    <span style={{ color: '#2e7d32' }}>{formatMoney(pendingRetiroDetails.montoTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details Popup Modal */}
      {selectedPagoId !== null && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedPagoId(null)}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '12px', width: '90%', maxWidth: '650px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '15px' }} onClick={(e) => e.stopPropagation()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                Detalle de Pago PAG-{String(selectedPagoId).padStart(6, '0')}
              </h3>
              <button type="button" onClick={() => setSelectedPagoId(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
            </header>

            {paymentDetails ? (
              <>
                <div className="payout-details-meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f5f7fa', padding: '15px', borderRadius: '8px', fontSize: '13px' }}>
                  <div><strong>Solicitudes de retiro:</strong> {paymentDetails.retiros.length}</div>
                  <div><strong>Fecha de Pago:</strong> {formatDate(paymentDetails.fechaPago)}</div>
                  <div><strong>Estado:</strong> {paymentDetails.estado}</div>
                  <div><strong>Monto Total Pago:</strong> <strong style={{ color: '#075ed7' }}>{formatMoney(paymentDetails.montoTotal)}</strong></div>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '5px' }}>Solicitudes de retiro incluidas:</div>
                <div style={{ border: '1px solid #eee', borderRadius: '8px' }}>
                  <table className="payout-request-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ background: '#f8fafc' }}>
                      <tr style={{ borderBottom: '1px solid #eee' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Cód. Solicitud</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Tienda</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Fecha de Solicitud</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px' }}>Monto Pagado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentDetails.retiros.map((retiro) => (
                        <tr key={retiro.retiroId}>
                          <td style={{ padding: '8px 12px' }}><strong>RET-{String(retiro.retiroId).padStart(6, '0')}</strong></td>
                          <td style={{ padding: '8px 12px' }}>{retiro.nombreTienda}</td>
                          <td style={{ padding: '8px 12px' }}>{formatDate(retiro.fecha)}</td>
                          <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 'bold' }}>{formatMoney(retiro.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #eee', marginTop: '10px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Suma Total del Pago:</span>
                  <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#2e7d32' }}>{formatMoney(paymentDetails.montoTotal)}</span>
                </div>


              </>
            ) : (
              <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
                No se pudo cargar la información del retiro.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Procesar Pago Warning Modal */}
      {isProcesarModalOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '12px', width: '90%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'center' }}>
            <div style={{ color: '#d32f2f', display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <UiIcon name="alert" style={{ width: '48px', height: '48px' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#1a202c' }}>Confirmar Procesamiento de Pagos</h3>
            
            <p style={{ fontSize: '14px', color: '#4a5568', lineHeight: '1.6', margin: '10px 0' }}>
              Estás a punto de marcar las <strong>{pendingWithdrawals.length} solicitudes</strong> de retiro del ciclo actual como <strong>PAGADAS</strong>.
            </p>

            <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '12px 15px', color: '#9b2c2c', fontSize: '13px', textAlign: 'left', lineHeight: '1.5' }}>
              <strong>⚠️ ADVERTENCIA DE SEGURIDAD:</strong><br />
              Por favor, valida y confirma que el banco ya haya gestionado y procesado los depósitos correspondientes de forma correcta. Esta acción moverá las solicitudes al historial de forma definitiva.
            </div>

            <footer style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '15px' }}>
              <button 
                className="secondary-button" 
                type="button" 
                onClick={() => setIsProcesarModalOpen(false)}
                disabled={processingBulk}
                style={{ minWidth: '100px' }}
              >
                Cancelar
              </button>
              <button 
                className="primary-button" 
                type="button" 
                onClick={handleConfirmProcesarPago}
                disabled={processingBulk}
                style={{ background: '#d32f2f', borderColor: '#d32f2f', color: '#fff', minWidth: '150px' }}
              >
                {processingBulk ? 'Procesando...' : 'Sí, confirmar pago'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {incompleteDocumentSellers.length > 0 && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setIncompleteDocumentSellers([])}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: 12, width: '90%', maxWidth: 520, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,.15)' }} onClick={(event) => event.stopPropagation()}>
            <div style={{ color: '#d32f2f', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <UiIcon name="alert" style={{ width: 48, height: 48 }} />
            </div>
            <h3 style={{ margin: 0, textAlign: 'center', color: '#1a202c' }}>Boleta o factura pendiente</h3>
            <p style={{ margin: '16px 0 10px', color: '#4a5568', lineHeight: 1.6 }}>
              Falta completar el formulario de registro de boleta/factura para {incompleteDocumentSellers.length === 1 ? 'el vendedor' : 'los vendedores'}:
            </p>
            <ul style={{ margin: '0 0 20px', paddingLeft: 22, color: '#9b2c2c', fontWeight: 700 }}>
              {incompleteDocumentSellers.map((seller) => <li key={seller}>{seller}</li>)}
            </ul>
            <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, padding: 12, color: '#9b2c2c', fontSize: 13 }}>
              Completa todos los campos y adjunta el PDF antes de procesar el pago.
            </div>
            <footer style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <button className="primary-button" type="button" onClick={() => setIncompleteDocumentSellers([])}>Entendido</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
