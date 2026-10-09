import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as administrationApi from '@/api/administration';
import type { CreditNotePending, EmisorNotaCredito, NivelNotaCredito } from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import MetricCard from '@/components/shared/MetricCard';
import Modal from '@/components/shared/Modal';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import UiIcon from '@/components/shared/UiIcon';
import { formatOrderNumber } from '@/utils/orderNumber';
import { chileDay, formatDate, formatDateTimeLocal, formatMoney } from './utils';

/**
 * Cumplimiento SII: las obligaciones de RepuesTop ante el SII que no son el pago semanal.
 *
 * Primer panel, pendiente D de la revision contable (2026-10-08): las ventas deshechas que
 * necesitan nota de credito. Pasados 6 meses desde la entrega la nota ya no rebaja el IVA
 * (art. 21 N° 2 y art. 70 DL 825; pregunta frecuente SII 001.130.1212). Aqui llegan despues la
 * nomina semestral al SII, la consulta de boletas de venta y el reporte del art. 35 I.
 */

const NIVEL_LABEL: Record<NivelNotaCredito, { text: string; tone: string }> = {
  VENCIDA: { text: 'Vencida', tone: 'tone-red' },
  CRITICO: { text: 'Crítica', tone: 'tone-red' },
  AVISO: { text: 'Atrasada', tone: 'tone-amber' },
  AL_DIA: { text: 'Al día', tone: 'tone-green' },
};

const EMISOR_LABEL: Record<EmisorNotaCredito, string> = {
  TIENDA: 'Tienda',
  REPUESTOP: 'RepuesTop',
};

interface CreditNoteDraft {
  pending: CreditNotePending;
  folio: string;
  fechaEmision: string;
  monto: string;
  archivo: File | null;
}

function todayChile(): string {
  return chileDay(new Date().toISOString());
}

function pedidoLabel(codigo: string | null, id: number | null): string {
  return codigo ? formatOrderNumber(codigo) : id != null ? `#${id}` : '—';
}

function NotasCreditoPanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CreditNoteDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftError, setDraftError] = useState('');

  const panelQuery = useQuery({
    queryKey: ['admin-credit-notes'],
    queryFn: administrationApi.getCreditNotes,
  });
  const pendientes = panelQuery.data?.pendientes ?? [];
  const registradas = panelQuery.data?.registradas ?? [];
  const mediaciones = panelQuery.data?.mediacionesPorVencer ?? [];
  const criticas = pendientes.filter((p) => p.nivel === 'CRITICO').length;
  const vencidas = pendientes.filter((p) => p.nivel === 'VENCIDA').length;

  function openDraft(pending: CreditNotePending): void {
    setDraftError('');
    setDraft({
      pending,
      folio: '',
      fechaEmision: todayChile(),
      monto: pending.montoReembolso != null ? String(Math.round(pending.montoReembolso)) : '',
      archivo: null,
    });
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft || saving) return;
    if (!draft.folio.trim() || !draft.fechaEmision || !draft.archivo) {
      setDraftError('Ingresa el folio, la fecha de emisión y adjunta el PDF de la nota de crédito.');
      return;
    }
    setSaving(true);
    setDraftError('');
    try {
      await administrationApi.registerCreditNote({
        pagoReembolsoId: draft.pending.pagoReembolsoId,
        emisor: draft.pending.emisor,
        folio: draft.folio.trim(),
        fechaEmision: draft.fechaEmision,
        monto: draft.monto.trim() ? Number(draft.monto) : null,
      }, draft.archivo);
      await queryClient.invalidateQueries({ queryKey: ['admin-credit-notes'] });
      setDraft(null);
    } catch (error) {
      setDraftError(mensajeDeError(error, 'No se pudo registrar la nota de crédito.'));
    } finally {
      setSaving(false);
    }
  }

  async function openPdf(id: number): Promise<void> {
    try {
      const url = await administrationApi.getCreditNoteUrl(id);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      window.alert(mensajeDeError(error, 'No se pudo abrir el PDF de la nota de crédito.'));
    }
  }

  return (
    <>
      {panelQuery.isError && (
        <QueryErrorNotice error={panelQuery.error} what="las notas de crédito" onRetry={() => panelQuery.refetch()} />
      )}

      <div className="metric-grid compact">
        <MetricCard label="Notas pendientes" value={pendientes.length} tone="blue" iconName="receipt"
          description="Ventas deshechas sin nota de crédito registrada" />
        <MetricCard label="Críticas" value={criticas} tone="amber" iconName="clock"
          description="A un mes o menos de perder la rebaja del IVA" />
        <MetricCard label="Vencidas" value={vencidas} tone="red" iconName="alert"
          description="Pasaron 6 meses desde la entrega: ya no rebajan el IVA" />
        <MetricCard label="Mediaciones al límite" value={mediaciones.length} tone="violet" iconName="scale"
          description="Abiertas con más de 150 días desde la entrega" />
      </div>

      <div className="notice">
        <UiIcon name="info" />
        {/* Un solo bloque de texto: .notice es flex y cada <strong> suelto quedaba como columna. */}
        <span>
          Una venta deshecha solo rebaja el IVA si la nota de crédito se emite dentro de 6 meses desde la entrega
          (art. 21 N° 2 y art. 70 DL 825). La nota de la <strong>tienda</strong> anula su boleta de venta; la de
          {' '}<strong>RepuesTop</strong> anula la factura de comisión cuando el reembolso llegó después de liquidar el retiro.
        </span>
      </div>

      <section className="table-shell">
        <div className="table-toolbar"><h2>Notas de crédito pendientes</h2></div>
        {panelQuery.isLoading ? (
          <p className="panel-hint">Cargando…</p>
        ) : pendientes.length === 0 ? (
          <p className="panel-hint">No hay ventas deshechas pendientes de nota de crédito.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="wide-table">
              <thead>
                <tr>
                  <th>Plazo</th>
                  <th>Vence el</th>
                  <th>Pedido</th>
                  <th>Tienda</th>
                  <th>Origen</th>
                  <th>Reembolso</th>
                  <th>Emite</th>
                  <th>Anula</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendientes.map((p) => (
                  <tr key={`${p.pagoReembolsoId}-${p.emisor}`}>
                    <td>
                      <span className={`status-pill ${NIVEL_LABEL[p.nivel].tone}`}>{NIVEL_LABEL[p.nivel].text}</span>
                      {p.devolucionFueraDePlazo && <div className="panel-hint">Devolución fuera de plazo</div>}
                    </td>
                    <td>
                      {formatDate(p.venceEl)}
                      <div className="panel-hint">
                        {p.diasRestantes >= 0 ? `${p.diasRestantes} días` : `hace ${-p.diasRestantes} días`}
                        {' · desde '}{p.tipoFechaBase === 'ENTREGA' ? 'la entrega' : p.tipoFechaBase === 'BOLETA' ? 'la boleta' : 'la factura'}
                      </div>
                    </td>
                    <td>{pedidoLabel(p.codigoPedido, p.pedidoId)}</td>
                    <td>{p.nombreTienda ?? '—'}</td>
                    <td>{p.origen}</td>
                    <td>{p.montoReembolso != null ? formatMoney(p.montoReembolso) : '—'}</td>
                    <td>{EMISOR_LABEL[p.emisor]}{p.codigoRetiro && <div className="panel-hint">{p.codigoRetiro}</div>}</td>
                    <td>{p.documentoAnulado}</td>
                    <td>
                      <button className="secondary-button" type="button" onClick={() => openDraft(p)}>
                        <UiIcon name="upload" /> Registrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mediaciones.length > 0 && (
        <section className="table-shell">
          <div className="table-toolbar"><h2>Mediaciones abiertas cerca del límite</h2></div>
          <p className="panel-hint">Si terminan en reembolso después de la fecha de vencimiento, el IVA de esa venta ya no se recupera.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="wide-table">
              <thead>
                <tr><th>Vence el</th><th>Pedido</th><th>Tienda</th><th>Entrega</th></tr>
              </thead>
              <tbody>
                {mediaciones.map((m) => (
                  <tr key={m.mediacionId}>
                    <td>{formatDate(m.venceEl)}<div className="panel-hint">{m.diasRestantes >= 0 ? `${m.diasRestantes} días` : 'vencida'}</div></td>
                    <td>{pedidoLabel(m.codigoPedido, m.pedidoId)}</td>
                    <td>{m.nombreTienda ?? '—'}</td>
                    <td>{formatDate(m.fechaEntrega)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="table-shell">
        <div className="table-toolbar"><h2>Notas de crédito registradas</h2></div>
        {registradas.length === 0 ? (
          <p className="panel-hint">Todavía no hay notas de crédito registradas.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="wide-table">
              <thead>
                <tr><th>Emisión</th><th>Folio</th><th>Emite</th><th>Pedido</th><th>Tienda</th><th>Monto</th><th>Registrada</th><th /></tr>
              </thead>
              <tbody>
                {registradas.map((n) => (
                  <tr key={n.id}>
                    <td>
                      {formatDate(n.fechaEmision)}
                      {n.emitidaFueraDePlazo && <div><span className="status-pill tone-red">Fuera de plazo</span></div>}
                    </td>
                    <td>{n.folio}</td>
                    <td>{EMISOR_LABEL[n.emisor]}</td>
                    <td>{pedidoLabel(n.codigoPedido, n.pedidoId)}</td>
                    <td>{n.nombreTienda ?? '—'}</td>
                    <td>{n.monto != null ? formatMoney(n.monto) : '—'}</td>
                    <td>{formatDateTimeLocal(n.registradaAt)}{n.registradaPor && <div className="panel-hint">{n.registradaPor}</div>}</td>
                    <td>
                      {n.tieneArchivo && (
                        <button className="action-button neutral" type="button" onClick={() => void openPdf(n.id)} title="Ver PDF">
                          <UiIcon name="eye" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal isOpen={draft !== null} onClose={() => setDraft(null)} title="Registrar nota de crédito">
        {draft && (
          <form className="form-grid" onSubmit={saveDraft}>
            <p className="panel-hint" style={{ gridColumn: '1 / -1' }}>
              Pedido <strong>{pedidoLabel(draft.pending.codigoPedido, draft.pending.pedidoId)}</strong> · {draft.pending.nombreTienda ?? '—'}
              {' · '}emite <strong>{EMISOR_LABEL[draft.pending.emisor]}</strong> · anula: {draft.pending.documentoAnulado}.
              {' '}Vence el {formatDate(draft.pending.venceEl)}.
            </p>
            <label className="form-field">
              <span>Folio (número que asignó el SII)</span>
              <input className="input" type="text" inputMode="numeric" pattern="[0-9]+" required
                value={draft.folio} onChange={(event) => setDraft({ ...draft, folio: event.target.value })} />
            </label>
            <label className="form-field">
              <span>Fecha de emisión</span>
              <input className="input" type="date" max={todayChile()} required
                value={draft.fechaEmision} onChange={(event) => setDraft({ ...draft, fechaEmision: event.target.value })} />
            </label>
            <label className="form-field">
              <span>Monto total de la nota (IVA incluido)</span>
              <input className="input" type="number" min="1" step="1"
                value={draft.monto} onChange={(event) => setDraft({ ...draft, monto: event.target.value })} />
            </label>
            <label className="form-field">
              <span>PDF de la nota de crédito</span>
              <input className="input" type="file" accept=".pdf,application/pdf" required
                onChange={(event) => setDraft({ ...draft, archivo: event.target.files?.[0] ?? null })} />
            </label>
            {draft.fechaEmision > draft.pending.venceEl && (
              <div className="notice" style={{ gridColumn: '1 / -1' }}>
                <UiIcon name="alert" /> La fecha de emisión es posterior al vencimiento: la nota queda como respaldo, pero ya no rebaja el IVA.
              </div>
            )}
            {draftError && <div className="notice notice-error" style={{ gridColumn: '1 / -1' }}>{draftError}</div>}
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setDraft(null)}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Registrar nota'}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/**
 * Cumplimiento SII: notas de credito de las ventas deshechas (plazo de 6 meses, art. 21 N° 2 y
 * art. 70 DL 825). La alerta de las 08:05 enlaza aqui con ?tab=notas.
 *
 * 9-oct: la situacion tributaria de las tiendas paso a Confianza → Cumplimiento tributario, que
 * aprueba las tiendas y las reverifica. Los avisos antiguos con ?tab=situacion se redirigen alla.
 */
export default function CumplimientoSiiPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  if (searchParams.get('tab') === 'situacion') {
    return <Navigate to="/confianza/cumplimiento-tributario" replace />;
  }

  return (
    <div className="admin-finance-page">
      <header className="page-header">
        <div className="header-title">
          <h1>Notas de crédito</h1>
          <p>Ventas deshechas que deben anularse con nota de crédito dentro de 6 meses desde la entrega.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" title="Actualizar datos"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin-credit-notes'] })}>
            <UiIcon name="refresh" /> Actualizar
          </button>
        </div>
      </header>

      <NotasCreditoPanel />
    </div>
  );
}
