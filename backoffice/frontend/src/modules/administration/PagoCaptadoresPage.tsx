import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as capturerApi from '@/api/capturers';
import * as administrationApi from '@/api/administration';
import UiIcon from '@/components/shared/UiIcon';
import MetricCard from '@/components/shared/MetricCard';
import { formatCurrency } from '@/utils/formatters';
import type { CapturerWithdrawal } from '@/types/capturer';
import { downloadFile } from './utils';
import { BCI_NOMINA_MIME_TYPE, buildBciNominaWorkbook } from './bciNominaExport';
import type { RetiroAdminResponse } from './types';

type Tab = 'gestion' | 'historial';

interface PaymentRound {
  key: string;
  withdrawals: CapturerWithdrawal[];
  total: number;
}

function paymentRoundKey(withdrawal: CapturerWithdrawal) {
  return (withdrawal.fechaPago || withdrawal.fecha).slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function capturerWithdrawalToNominaRow(withdrawal: CapturerWithdrawal): RetiroAdminResponse {
  const beneficiary = withdrawal.titular || withdrawal.captador || withdrawal.alias || 'Captador RepuesTop';
  return {
    retiroId: withdrawal.id,
    nombreTienda: beneficiary,
    rut: withdrawal.rut || '',
    razonSocial: beneficiary,
    banco: withdrawal.banco || '',
    tipoCuenta: withdrawal.tipoCuenta || '',
    numeroCuenta: withdrawal.numeroCuenta || '',
    codigoRetiro: withdrawal.codigo,
    bankCode: withdrawal.bankCode ?? null,
    bankAccountHolderName: beneficiary,
    bankAccountNotificationEmail: withdrawal.email || '',
    mensajeDestinatario: withdrawal.email ? `Pago retiro captador ${withdrawal.codigo}` : '',
    monto: withdrawal.monto,
    email: withdrawal.email || '',
    fecha: withdrawal.fecha,
    estado: withdrawal.estado,
    fechaEfectiva: withdrawal.fechaPago || '',
  };
}

export default function PagoCaptadoresPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('gestion');
  const [rejectionTarget, setRejectionTarget] = useState<CapturerWithdrawal | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [exportingExcel, setExportingExcel] = useState(false);

  const withdrawalsQuery = useQuery({
    queryKey: ['capturer-withdrawals'],
    queryFn: capturerApi.listCapturerWithdrawals,
  });
  const paymentConfigQuery = useQuery({
    queryKey: ['admin-configuracion-pagos'],
    queryFn: administrationApi.getConfiguracionPagos,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['capturer-withdrawals'] });
  const payMutation = useMutation({
    mutationFn: capturerApi.payCapturerWithdrawal,
    onSuccess: refresh,
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => capturerApi.rejectCapturerWithdrawal(id, reason),
    onSuccess: () => {
      setRejectionTarget(null);
      setRejectionReason('');
      refresh();
    },
  });

  const withdrawals = withdrawalsQuery.data ?? [];
  const pending = useMemo(() => withdrawals.filter((withdrawal) => withdrawal.estado === 'PENDIENTE'), [withdrawals]);
  const paid = useMemo(() => withdrawals.filter((withdrawal) => withdrawal.estado === 'PAGADO'), [withdrawals]);
  const pendingTotal = useMemo(() => pending.reduce((total, withdrawal) => total + withdrawal.monto, 0), [pending]);
  const paidTotal = useMemo(() => paid.reduce((total, withdrawal) => total + withdrawal.monto, 0), [paid]);

  const paymentRounds = useMemo<PaymentRound[]>(() => {
    const rounds = new Map<string, CapturerWithdrawal[]>();
    paid.forEach((withdrawal) => {
      const key = paymentRoundKey(withdrawal);
      rounds.set(key, [...(rounds.get(key) ?? []), withdrawal]);
    });
    return [...rounds.entries()]
      .map(([key, roundWithdrawals]) => ({
        key,
        withdrawals: roundWithdrawals,
        total: roundWithdrawals.reduce((total, withdrawal) => total + withdrawal.monto, 0),
      }))
      .sort((first, second) => second.key.localeCompare(first.key));
  }, [paid]);

  const isSubmitting = payMutation.isPending || rejectMutation.isPending;

  const handleExportExcel = async () => {
    if (pending.length === 0) return;
    const cuentaCargoBci = paymentConfigQuery.data?.cuentaCargoBci?.trim();
    if (!cuentaCargoBci) {
      alert('Falta configurar la cuenta de cargo BCI. Puedes hacerlo desde Pago a proveedores.');
      return;
    }

    setExportingExcel(true);
    try {
      const buffer = await buildBciNominaWorkbook(pending.map(capturerWithdrawalToNominaRow), cuentaCargoBci);
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(`Nomina_Pago_en_Linea-captadores-${date}.xlsx`, buffer, BCI_NOMINA_MIME_TYPE);
    } catch (error) {
      alert(`No se pudo generar el Excel: ${error instanceof Error ? error.message : 'Error desconocido.'}`);
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <section className="admin-finance-page pago-proveedores-page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Administración contable</span>
          <h1>Pago a captadores</h1>
          <p>Gestiona los retiros solicitados por captadores y sus boletas de honorarios.</p>
        </div>
      </header>

      <div className="module-tabs">
        <button className={activeTab === 'gestion' ? 'active' : ''} type="button" onClick={() => setActiveTab('gestion')}>
          <UiIcon name="wallet" /> Solicitudes de retiro
        </button>
        <button className={activeTab === 'historial' ? 'active' : ''} type="button" onClick={() => setActiveTab('historial')}>
          <UiIcon name="clock" /> Historial por rondas
        </button>
      </div>

      {activeTab === 'gestion' ? (
        <>
          <div className="metric-grid compact" style={{ marginBottom: 20 }}>
            <MetricCard label="Monto pendiente" value={formatCurrency(pendingTotal)} tone="blue" description="Retiros listos para revisar" iconName="wallet" />
            <MetricCard label="Solicitudes pendientes" value={pending.length} tone="amber" description="Con boleta de honorarios" iconName="receipt" />
          </div>

          <section className="table-shell">
            <div className="table-toolbar">
              <div>
                <h2>Retiros pendientes</h2>
                <p>Solo se muestran solicitudes que incluyen su boleta de honorarios en PDF.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="status-pill warning">{pending.length} por revisar</span>
                <button className="primary-button compact-action" type="button" onClick={() => void handleExportExcel()} disabled={pending.length === 0 || exportingExcel || paymentConfigQuery.isLoading}>
                  <UiIcon name="download" /> {exportingExcel ? 'Generando...' : 'Exportar Excel'}
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table>
                  <thead>
                    <tr>
                      <th>Solicitud</th>
                      <th>Captador</th>
                      <th>Cuenta de destino</th>
                      <th>Boleta de honorarios</th>
                      <th>Monto</th>
                      <th>Fecha solicitud</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                <tbody>
                  {withdrawalsQuery.isLoading ? (
                    <tr><td colSpan={7} className="empty-state" style={{ textAlign: 'center' }}>Cargando solicitudes de retiro…</td></tr>
                  ) : pending.length === 0 ? (
                    <tr><td colSpan={7} className="empty-state" style={{ textAlign: 'center' }}>No hay solicitudes de retiro de captadores pendientes.</td></tr>
                  ) : pending.map((withdrawal) => (
                      <tr key={withdrawal.id}>
                        <td><strong>{withdrawal.codigo}</strong></td>
                        <td>
                          <strong>{withdrawal.captador || 'Captador'}</strong>
                          <small>@{withdrawal.alias || 'sin-alias'} · {withdrawal.rut || 'RUT no informado'}</small>
                        </td>
                        <td>
                          <strong>{withdrawal.banco || 'Banco no informado'}</strong>
                          <small>{withdrawal.tipoCuenta || 'Cuenta'} · {withdrawal.numeroCuenta || 'Sin número'}</small>
                        </td>
                        <td>
                          <button className="secondary-button compact-action" type="button" onClick={() => void capturerApi.downloadCapturerReceipt(withdrawal.id, withdrawal.boletaNombre)}>
                            <UiIcon name="document" /> Ver boleta
                          </button>
                        </td>
                        <td><strong>{formatCurrency(withdrawal.monto)}</strong></td>
                        <td>{formatDateTime(withdrawal.fecha)}</td>
                        <td>
                          <div className="table-actions">
                            <button className="primary-button compact-action" type="button" disabled={isSubmitting} onClick={() => {
                              if (window.confirm(`¿Confirmas el pago de ${formatCurrency(withdrawal.monto)} a ${withdrawal.alias || withdrawal.captador || 'este captador'}?`)) {
                                payMutation.mutate(withdrawal.id);
                              }
                            }}>
                              <UiIcon name="check" /> Pagar
                            </button>
                            <button className="secondary-button compact-action" type="button" disabled={isSubmitting} onClick={() => setRejectionTarget(withdrawal)}>
                              Rechazar
                            </button>
                          </div>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="metric-grid compact" style={{ marginBottom: 20 }}>
            <MetricCard label="Total pagado" value={formatCurrency(paidTotal)} tone="green" description="Histórico de retiros procesados" iconName="wallet" />
            <MetricCard label="Rondas procesadas" value={paymentRounds.length} tone="violet" description="Agrupadas por fecha de pago" iconName="clock" />
            <MetricCard label="Retiros pagados" value={paid.length} tone="blue" description="Solicitudes completadas" iconName="check" />
          </div>

          <section className="table-shell">
            <div className="table-toolbar">
              <div>
                <h2>Historial por ronda de pago</h2>
                <p>Cada ronda reúne los retiros de captadores pagados en la misma fecha.</p>
              </div>
              <span className="status-pill success">{paymentRounds.length} rondas</span>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Ronda</th>
                    <th>Fecha de pago</th>
                    <th>Retiros procesados</th>
                    <th>Captadores</th>
                    <th>Códigos incluidos</th>
                    <th>Total pagado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawalsQuery.isLoading ? (
                    <tr><td colSpan={7} className="empty-state" style={{ textAlign: 'center' }}>Cargando historial de pagos…</td></tr>
                  ) : paymentRounds.length === 0 ? (
                    <tr><td colSpan={7} className="empty-state" style={{ textAlign: 'center' }}>Aún no existen rondas de pago para captadores.</td></tr>
                  ) : paymentRounds.map((round) => (
                    <tr key={round.key}>
                      <td><strong>Ronda {round.key}</strong></td>
                      <td>{formatDate(round.withdrawals[0]?.fechaPago)}</td>
                      <td>{round.withdrawals.length}</td>
                      <td>{round.withdrawals.map((withdrawal) => withdrawal.alias || withdrawal.captador || 'Captador').join(', ')}</td>
                      <td>{round.withdrawals.map((withdrawal) => withdrawal.codigo).join(', ')}</td>
                      <td><strong>{formatCurrency(round.total)}</strong></td>
                      <td><span className="status-pill success">Pagado</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {rejectionTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="reject-capturer-withdrawal-title">
            <div className="modal-header">
              <div>
                <h2 id="reject-capturer-withdrawal-title">Rechazar solicitud</h2>
                <p>{rejectionTarget.codigo} · {formatCurrency(rejectionTarget.monto)}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setRejectionTarget(null)} aria-label="Cerrar"><UiIcon name="close" /></button>
            </div>
            <label className="form-field">
              <span>Motivo de rechazo</span>
              <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Indica al captador qué debe corregir." rows={4} />
            </label>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setRejectionTarget(null)}>Cancelar</button>
              <button className="danger-button" type="button" disabled={isSubmitting || !rejectionReason.trim()} onClick={() => rejectMutation.mutate({ id: rejectionTarget.id, reason: rejectionReason.trim() })}>
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
