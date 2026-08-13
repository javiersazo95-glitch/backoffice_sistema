import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import * as adminApi from '@/api/administration';
import UiIcon from '@/components/shared/UiIcon';
import MetricCard from '@/components/shared/MetricCard';
import FounderSellerName from '@/components/shared/FounderSellerName';
import SellerListTooltip from '@/components/shared/SellerListTooltip';
import { downloadFile } from './utils';
import { buildBciNominaWorkbook, socioToNominaRow, BCI_NOMINA_MIME_TYPE } from './bciNominaExport';
import type { RetiroAdminResponse, RetiroDetalleResponse, PagoProveedorResponse, ConfiguracionPagos, Withdrawal } from './types';

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

/**
 * Los pagos creados antes de vincular bo_retiro_socio con RT_pago_proveedor no tienen
 * `retirosSocios` en la API. En esos registros legados, fechaPago fue guardada al mismo
 * instante que el pago, por lo que permite mostrarlos sin afectar los pagos nuevos.
 */
function sociosDelPago(payment: PagoProveedorResponse, partnerWithdrawals: Withdrawal[]): Withdrawal[] {
  if (payment.retirosSocios?.length) return payment.retirosSocios;
  const fechaPago = new Date(payment.fechaPago).getTime();
  return partnerWithdrawals.filter((withdrawal) =>
    withdrawal.estado === 'PAGADO'
    && withdrawal.fechaPago
    && Math.abs(new Date(withdrawal.fechaPago).getTime() - fechaPago) < 5 * 60 * 1000,
  );
}

export default function PagoProveedoresPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'gestion' | 'historial'>('gestion');
  const [isProcesarModalOpen, setIsProcesarModalOpen] = useState(false);
  const [processingBulk, setProcessingBulk] = useState(false);
  const [incompleteDocumentSellers, setIncompleteDocumentSellers] = useState<string[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [cuentaCargoDraft, setCuentaCargoDraft] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Filters for History Tab
  const [historyCodeFilter, setHistoryCodeFilter] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  // Selected withdrawal for detail popup
  const [selectedPagoId, setSelectedPagoId] = useState<number | null>(null);
  const [selectedPendingRetiroId, setSelectedPendingRetiroId] = useState<number | null>(null);

  // Modal para cargar documento tributario de socio desde Pago a Proveedores
  const [partnerDocModal, setPartnerDocModal] = useState<{
    retiroId: number;
    beneficiary: string;
    type: string;
    rut: string;
    razonSocial: string;
    email: string;
    detalle: string;
    iva: string;
    pdfName?: string;
    pdfFile?: File;
  } | null>(null);
  const [savingPartnerDoc, setSavingPartnerDoc] = useState(false);

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

  const { data: configuracionPagos } = useQuery<ConfiguracionPagos>({
    queryKey: ['admin-configuracion-pagos'],
    queryFn: adminApi.getConfiguracionPagos,
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

  // BO-SOCIOS-001: retiros de libre disposicion de los socios fundadores. Se muestran en
  // un bloque aparte porque no son proveedores (no emiten boleta) y su pago no entra a la
  // nomina BCI de vendedores (ver nota en el bloque "Socios" mas abajo).
  const { data: partnerWithdrawals = [], refetch: refetchPartnerWithdrawals } = useQuery<Withdrawal[]>({
    queryKey: ['admin-partner-withdrawals'],
    queryFn: adminApi.getPartnerWithdrawals,
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

  // La fecha del retiro de socio puede ser futura (por ejemplo, cierre de mes), pero la
  // solicitud ya está disponible para pago. A diferencia de `createdAt` de un proveedor,
  // `date` es la fecha contable del retiro y no debe excluirlo del flujo actual.
  const pendingPartnerWithdrawals = useMemo(() => {
    return partnerWithdrawals.filter((w) => (w.estado ?? 'PENDIENTE') === 'PENDIENTE');
  }, [partnerWithdrawals]);

  // Un solo pago contable agrupa retiros de proveedores y socios. El backend conserva el
  // tipo y codigo propio del socio y los vincula al mismo PAG-xxxxxx.
  const handleConfirmProcesarPago = async () => {
    setProcessingBulk(true);
    const errores: string[] = [];

    // 1. Re-fetch y validar que todos los documentos (proveedores y socios) estén completos antes de pagar
    const refreshedPartner = await refetchPartnerWithdrawals();
    const latestPendingPartner = (refreshedPartner.data ?? partnerWithdrawals)
      .filter((w) => (w.estado ?? 'PENDIENTE') === 'PENDIENTE');

    const refreshedSupplier = await refetch();
    const latestPendingWithdrawals = (refreshedSupplier.data ?? withdrawals).filter((withdrawal) => {
      const createdDate = new Date(withdrawal.fecha);
      return withdrawal.estado === 'SOLICITADO' && createdDate <= cycleEnd;
    });

    const incompletePartners = latestPendingPartner
      .filter((w) => !w.documentoLiquidacionCompleto && !(w.documentoLiquidacionNombre && w.documentoLiquidacionTipo && w.documentoLiquidacionRut))
      .map((w) => `Socio: ${w.beneficiary}`);

    const incompleteSellers = latestPendingWithdrawals
      .filter((withdrawal) => !withdrawal.documentoLiquidacionCompleto)
      .map((withdrawal) => withdrawal.nombreTienda);

    const allIncomplete = [...incompletePartners, ...incompleteSellers];
    if (allIncomplete.length > 0) {
      setIncompleteDocumentSellers([...new Set(allIncomplete)]);
      setIsProcesarModalOpen(false);
      setProcessingBulk(false);
      return;
    }

    // 2. Procesar ambos tipos en el mismo pago contable.
    if (latestPendingWithdrawals.length > 0 || latestPendingPartner.length > 0) {
      try {
        const payment = await adminApi.createWithdrawalPayment(
          latestPendingWithdrawals.map((withdrawal) => withdrawal.retiroId),
          latestPendingPartner.map((withdrawal) => Number(withdrawal.id)),
        );
        const requestedPartnerIds = new Set(latestPendingPartner.map((withdrawal) => String(withdrawal.id)));
        const paidPartnerIds = new Set((payment.retirosSocios ?? []).map((withdrawal) => String(withdrawal.id)));
        const missingPartners = [...requestedPartnerIds].filter((id) => !paidPartnerIds.has(id));
        if (missingPartners.length > 0) {
          throw new Error('El pago fue creado, pero el backend no confirmó todos los retiros de socios. Actualiza el backend antes de volver a procesar.');
        }
        queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
        queryClient.invalidateQueries({ queryKey: ['admin-withdrawal-payments'] });
        await refetchPartnerWithdrawals();
      } catch (err: unknown) {
        const message = isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : err instanceof Error ? err.message : 'error desconocido.';
        errores.push('Pago: ' + message);
      }
    }

    setProcessingBulk(false);
    setIsProcesarModalOpen(false);
    if (errores.length) {
      alert('Se procesó parcialmente. Errores:\n' + errores.join('\n'));
    } else {
      setActiveTab('historial');
      alert('El pago del ciclo, con proveedores y socios, ha sido procesado con éxito.');
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

  // Total sums (incluye retiros de socio, ver BO-SOCIOS-001)
  const pendingTotalAmount = useMemo(
    () => pendingWithdrawals.reduce((sum, w) => sum + w.monto, 0)
      + pendingPartnerWithdrawals.reduce((sum, w) => sum + w.amount, 0),
    [pendingWithdrawals, pendingPartnerWithdrawals],
  );
  const paidTotalAmount = useMemo(() => paidPayments.reduce((sum, payment) => sum + payment.montoTotal, 0), [paidPayments]);

  // Export a la nomina "Pago en Linea" de BCI (mismas columnas, colores y hojas que la
  // plantilla original), rellena con los datos bancarios registrados por cada vendedor.
  const handleExportExcel = async () => {
    // BO-SOCIOS-001: los retiros de socios van en la misma nomina, adaptados a la forma
    // de un retiro de vendedor (ver socioToNominaRow). Se identifican por su propio
    // codigoRetiro ("J-1", "E-1") para no chocar con el "RET-000001" de un vendedor.
    const nominaRows = [...pendingWithdrawals, ...pendingPartnerWithdrawals.map(socioToNominaRow)];
    if (nominaRows.length === 0) {
      alert('No hay solicitudes pendientes en el ciclo actual para exportar.');
      return;
    }
    const cuentaCargoBci = configuracionPagos?.cuentaCargoBci?.trim();
    if (!cuentaCargoBci) {
      alert('Falta configurar la "Cuenta de Cargo" antes de exportar. Usa el botón "Cuenta de cargo".');
      setIsConfigModalOpen(true);
      return;
    }

    setExportingExcel(true);
    try {
      const buffer = await buildBciNominaWorkbook(nominaRows, cuentaCargoBci);
      const startStr = cycleStart.toISOString().slice(0, 10);
      const endStr = cycleEnd.toISOString().slice(0, 10);
      downloadFile(`Nomina_Pago_en_Linea-ciclo-${startStr}-a-${endStr}.xlsx`, buffer, BCI_NOMINA_MIME_TYPE);
    } catch (err) {
      alert('No se pudo generar el Excel: ' + (err instanceof Error ? err.message : 'Error desconocido.'));
    } finally {
      setExportingExcel(false);
    }
  };

  const openConfigModal = () => {
    setCuentaCargoDraft(configuracionPagos?.cuentaCargoBci ?? '');
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await adminApi.updateConfiguracionPagos(cuentaCargoDraft.trim());
      queryClient.invalidateQueries({ queryKey: ['admin-configuracion-pagos'] });
      setIsConfigModalOpen(false);
    } catch (err) {
      alert('No se pudo guardar la cuenta de cargo: ' + (err instanceof Error ? err.message : 'Error desconocido.'));
    } finally {
      setSavingConfig(false);
    }
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
              disabled={pendingWithdrawals.length === 0 && pendingPartnerWithdrawals.length === 0}
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
              value={pendingWithdrawals.length + pendingPartnerWithdrawals.length}
              tone="green"
              description="Tiendas y socios esperando depósito"
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="secondary-button" type="button" onClick={openConfigModal} title="Configurar la cuenta de cargo usada en el Excel de BCI">
                  <UiIcon name="settings" /> Cuenta de cargo
                </button>
                <button className="primary-button" type="button" onClick={handleExportExcel} disabled={(pendingWithdrawals.length === 0 && pendingPartnerWithdrawals.length === 0) || exportingExcel}>
                  <UiIcon name="download" /> {exportingExcel ? 'Generando...' : 'Exportar Excel'}
                </button>
              </div>
            </div>
            
            <div className="table-wrap">
              <table className="wide-table">
                <thead>
                  <tr>
                    <th>Cód. Solicitud</th>
                    <th>Tipo</th>
                    <th>Solicitudes de retiro / Tiendas</th>
                    <th>RUT</th>
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
                  ) : pendingWithdrawals.length > 0 || pendingPartnerWithdrawals.length > 0 ? (
                    <>
                      {pendingWithdrawals.map((w) => (
                        <tr key={`prov-${w.retiroId}`}>
                          <td><strong>RET-{String(w.retiroId).padStart(6, '0')}</strong></td>
                          <td><span className="status-pill tone-blue">Proveedor</span></td>
                          <td><FounderSellerName name={w.nombreTienda} founder={w.sellerFounder} /></td>
                          <td>{w.rut}</td>
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
                      ))}
                      {/* BO-SOCIOS-001 & BO-SOCIOS-002: retiros de socio, distinguidos con la etiqueta "Socio".
                          Muestran el icono de documento tributario con feedback visual (verde si está cargado, amarillo si falta). */}
                      {pendingPartnerWithdrawals.map((w) => {
                        const isDocComplete = Boolean(
                          w.documentoLiquidacionCompleto ||
                          (w.documentoLiquidacionNombre && w.documentoLiquidacionTipo && w.documentoLiquidacionRut)
                        );
                        return (
                          <tr key={`socio-${w.id}`}>
                            <td><strong>{w.codigoRetiro || '—'}</strong></td>
                            <td><span className="status-pill tone-violet">Socio</span></td>
                            <td>{w.beneficiary}</td>
                            <td>{w.rut || '—'}</td>
                            <td>{w.banco || 'Sin registrar'}</td>
                            <td>{w.tipoCuenta || '—'}</td>
                            <td>{w.numeroCuenta || '—'}</td>
                            <td style={{ fontWeight: 'bold' }}>{formatMoney(w.amount)}</td>
                            <td>{w.email || '—'}</td>
                            <td>{formatDate(w.date)}</td>
                            <td>
                              <div className="action-cell">
                                <button
                                  className={`action-button ${isDocComplete ? 'success' : 'issue'}`}
                                  type="button"
                                  onClick={() => setPartnerDocModal({
                                    retiroId: Number(w.id),
                                    beneficiary: w.beneficiary,
                                    type: w.documentoLiquidacionTipo || 'Boleta de Honorarios',
                                    rut: w.documentoLiquidacionRut || w.rut || '',
                                    razonSocial: w.documentoLiquidacionRazonSocial || w.titular || w.beneficiary,
                                    email: w.documentoLiquidacionEmail || w.email || '',
                                    detalle: w.documentoLiquidacionDetalle || `Retiro de libre disposición socio - ${w.beneficiary}`,
                                    iva: w.documentoLiquidacionIva != null ? String(w.documentoLiquidacionIva) : '0',
                                    pdfName: w.documentoLiquidacionNombre || '',
                                  })}
                                  title={isDocComplete ? 'Ver / Editar documento tributario cargado' : 'Cargar documento tributario del socio'}
                                >
                                  <UiIcon name={isDocComplete ? 'fileCheck' : 'receipt'} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
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
                    <th>Socio</th>
                    <th>Monto Pagado</th>
                    <th>Fecha de Pago</th>
                    <th>Estado</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="loading-cell">Cargando historial de pagos...</td>
                    </tr>
                  ) : paidPayments.length > 0 ? (
                    paidPayments.map((payment) => {
                      const sociosPagados = sociosDelPago(payment, partnerWithdrawals);
                      const partnerSellers = sociosPagados.map((w) => ({ name: w.beneficiary, isPartner: true }));

                      return (
                        <tr key={payment.pagoId}>
                          <td>
                            <strong>PAG-{String(payment.pagoId).padStart(6, '0')}</strong>
                            <small style={{ display: 'block', color: '#6b7a90', marginTop: 3 }}>
                              {payment.retiros.length + sociosPagados.length} solicitudes de retiro
                            </small>
                          </td>
                          <td>
                            {payment.retiros.length > 0 ? (
                              <SellerListTooltip sellers={payment.retiros.map((retiro) => ({ name: retiro.nombreTienda, founder: retiro.sellerFounder }))} />
                            ) : (
                              <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>—</span>
                            )}
                          </td>
                          <td>
                            {partnerSellers.length > 0 ? (
                              <SellerListTooltip sellers={partnerSellers} />
                            ) : (
                              <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>—</span>
                            )}
                          </td>
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
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7}>
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

            {paymentDetails ? (() => {
              const sociosPagadosEnModal = sociosDelPago(paymentDetails, partnerWithdrawals);
              const totalSolicitudes = paymentDetails.retiros.length + sociosPagadosEnModal.length;
              const totalSuma = paymentDetails.montoTotal;

              return (
                <>
                  <div className="payout-details-meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f5f7fa', padding: '15px', borderRadius: '8px', fontSize: '13px' }}>
                    <div><strong>Solicitudes de retiro:</strong> {totalSolicitudes}</div>
                    <div><strong>Fecha de Pago:</strong> {formatDate(paymentDetails.fechaPago)}</div>
                    <div><strong>Estado:</strong> {paymentDetails.estado}</div>
                    <div><strong>Monto Total Pago:</strong> <strong style={{ color: '#075ed7' }}>{formatMoney(totalSuma)}</strong></div>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '5px' }}>Solicitudes de retiro incluidas:</div>
                  <div style={{ border: '1px solid #eee', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="payout-request-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                        <tr style={{ borderBottom: '1px solid #eee' }}>
                          <th style={{ textAlign: 'left', padding: '8px 12px' }}>Cód. Solicitud</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px' }}>Tienda / Beneficiario</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px' }}>Tipo</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px' }}>Fecha</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px' }}>Monto Pagado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentDetails.retiros.map((retiro) => (
                          <tr key={retiro.retiroId}>
                            <td style={{ padding: '8px 12px' }}><strong>{retiro.codigoRetiro || `RET-${String(retiro.retiroId).padStart(6, '0')}`}</strong></td>
                            <td style={{ padding: '8px 12px' }}><FounderSellerName name={retiro.nombreTienda} founder={retiro.sellerFounder} /></td>
                            <td style={{ padding: '8px 12px' }}><span className="status-pill tone-blue" style={{ fontSize: '11px' }}>Proveedor</span></td>
                            <td style={{ padding: '8px 12px' }}>{formatDate(retiro.fecha)}</td>
                            <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 'bold' }}>{formatMoney(retiro.monto)}</td>
                          </tr>
                        ))}
                        {sociosPagadosEnModal.map((w) => (
                          <tr key={`socio-modal-${w.id}`}>
                            <td style={{ padding: '8px 12px' }}><strong>{w.codigoRetiro || `SOCIO-${w.id}`}</strong></td>
                            <td style={{ padding: '8px 12px' }}><FounderSellerName name={w.beneficiary} isPartner={true} /></td>
                            <td style={{ padding: '8px 12px' }}><span className="status-pill tone-violet" style={{ fontSize: '11px' }}>Socio</span></td>
                            <td style={{ padding: '8px 12px' }}>{formatDate(w.date)}</td>
                            <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 'bold' }}>{formatMoney(w.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #eee', marginTop: '10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Suma Total del Pago:</span>
                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#2e7d32' }}>{formatMoney(totalSuma)}</span>
                  </div>
                </>
              );
            })() : (
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
              Estás a punto de marcar las <strong>{pendingWithdrawals.length} solicitudes de proveedores</strong>
              {pendingPartnerWithdrawals.length > 0 && <> y <strong>{pendingPartnerWithdrawals.length} de socios</strong></>} del ciclo actual como <strong>PAGADAS</strong>.
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
            <h3 style={{ margin: 0, textAlign: 'center', color: '#1a202c' }}>Documento tributario pendiente</h3>
            <p style={{ margin: '16px 0 10px', color: '#4a5568', lineHeight: 1.6 }}>
              Falta completar el formulario de registro de boleta/factura para {incompleteDocumentSellers.length === 1 ? 'el beneficiario' : 'los beneficiarios'}:
            </p>
            <ul style={{ margin: '0 0 20px', paddingLeft: 22, color: '#9b2c2c', fontWeight: 700 }}>
              {incompleteDocumentSellers.map((seller) => {
                const withdrawal = withdrawals.find((item) => item.nombreTienda === seller);
                return <li key={seller}>{seller.startsWith('Socio: ') ? seller : <FounderSellerName name={seller} founder={withdrawal?.sellerFounder} />}</li>;
              })}
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

      {partnerDocModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPartnerDocModal(null)}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: 12, width: '90%', maxWidth: 540, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,.15)' }} onClick={(e) => e.stopPropagation()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Cargar documento tributario — Socio: {partnerDocModal.beneficiary}</h3>
              <button type="button" onClick={() => setPartnerDocModal(null)} style={{ background: 'transparent', border: 0, fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </header>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!partnerDocModal.rut.trim() || !partnerDocModal.razonSocial.trim() || !partnerDocModal.email.trim() || !partnerDocModal.pdfName?.trim()) {
                alert('Completa RUT, Razón social, Email y adjunta el archivo PDF.');
                return;
              }
              setSavingPartnerDoc(true);
              try {
                await adminApi.saveLiquidationDocument({
                  retiroId: partnerDocModal.retiroId,
                  tipoDocumento: partnerDocModal.type.trim(),
                  rut: partnerDocModal.rut.trim(),
                  razonSocial: partnerDocModal.razonSocial.trim(),
                  email: partnerDocModal.email.trim(),
                  detalle: partnerDocModal.detalle.trim(),
                  ivaLiquidado: Number(partnerDocModal.iva) || 0,
                  eliminarDocumento: false,
                }, partnerDocModal.pdfFile);
                await refetchPartnerWithdrawals();
                setPartnerDocModal(null);
              } catch (err) {
                alert('No se pudo guardar el documento tributario: ' + (err instanceof Error ? err.message : 'error desconocido'));
              } finally {
                setSavingPartnerDoc(false);
              }
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#4a5568', marginBottom: 4 }}>Tipo de documento</label>
                  <select
                    className="select"
                    value={partnerDocModal.type}
                    onChange={(e) => setPartnerDocModal({ ...partnerDocModal, type: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cddde9' }}
                  >
                    <option value="Boleta de Honorarios">Boleta de Honorarios</option>
                    <option value="Boleta">Boleta</option>
                    <option value="Factura">Factura</option>
                    <option value="Documento Tributario">Documento Tributario</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#4a5568', marginBottom: 4 }}>RUT Receptor</label>
                    <input
                      type="text"
                      className="input"
                      value={partnerDocModal.rut}
                      onChange={(e) => setPartnerDocModal({ ...partnerDocModal, rut: e.target.value })}
                      placeholder="Ej: 15.123.456-7"
                      required
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cddde9' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#4a5568', marginBottom: 4 }}>Razón Social / Nombre</label>
                    <input
                      type="text"
                      className="input"
                      value={partnerDocModal.razonSocial}
                      onChange={(e) => setPartnerDocModal({ ...partnerDocModal, razonSocial: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cddde9' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#4a5568', marginBottom: 4 }}>Correo electrónico socio</label>
                  <input
                    type="email"
                    className="input"
                    value={partnerDocModal.email}
                    onChange={(e) => setPartnerDocModal({ ...partnerDocModal, email: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cddde9' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#4a5568', marginBottom: 4 }}>Detalle</label>
                  <input
                    type="text"
                    className="input"
                    value={partnerDocModal.detalle}
                    onChange={(e) => setPartnerDocModal({ ...partnerDocModal, detalle: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cddde9' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#4a5568', marginBottom: 4 }}>Adjuntar archivo PDF (*.pdf)</label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPartnerDocModal({ ...partnerDocModal, pdfFile: file, pdfName: file.name });
                      }
                    }}
                    style={{ width: '100%', padding: '6px' }}
                  />
                  {partnerDocModal.pdfName && (
                    <small style={{ color: '#2e7d32', fontWeight: 'bold' }}>✓ {partnerDocModal.pdfName}</small>
                  )}
                </div>
              </div>
              <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button className="secondary-button" type="button" onClick={() => setPartnerDocModal(null)} disabled={savingPartnerDoc}>Cancelar</button>
                <button className="primary-button" type="submit" disabled={savingPartnerDoc}>
                  {savingPartnerDoc ? 'Guardando...' : 'Guardar documento'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {isConfigModalOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setIsConfigModalOpen(false)}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: 12, width: '90%', maxWidth: 480, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,.15)' }} onClick={(event) => event.stopPropagation()}>
            <h3 style={{ margin: 0, color: '#1a202c' }}>Cuenta de cargo (BCI)</h3>
            <p style={{ margin: '10px 0 16px', color: '#4a5568', fontSize: 13, lineHeight: 1.5 }}>
              Cuenta bancaria de RepuesTop que aparecerá en la columna "Nº Cuenta de Cargo" de la nómina exportada. Se guarda una sola vez y aplica a todos los exports.
            </p>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#2d3748', marginBottom: 6 }}>Número de cuenta de cargo</label>
            <input
              type="text"
              className="form-input"
              value={cuentaCargoDraft}
              onChange={(event) => setCuentaCargoDraft(event.target.value)}
              placeholder="Ej. 78.474.031-5"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e0', borderRadius: 8, fontSize: 14 }}
            />
            <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button className="secondary-button" type="button" onClick={() => setIsConfigModalOpen(false)} disabled={savingConfig}>Cancelar</button>
              <button className="primary-button" type="button" onClick={handleSaveConfig} disabled={savingConfig || !cuentaCargoDraft.trim()}>
                {savingConfig ? 'Guardando...' : 'Guardar'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
