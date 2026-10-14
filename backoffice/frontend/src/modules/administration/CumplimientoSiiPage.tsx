import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as administrationApi from '@/api/administration';
import type { CreditNotePending, CreditNoteRegistered, EmisorNotaCredito, NivelNotaCredito } from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import MetricCard from '@/components/shared/MetricCard';
import Modal from '@/components/shared/Modal';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import UiIcon from '@/components/shared/UiIcon';
import { formatOrderNumber } from '@/utils/orderNumber';
import { chileDay, formatDate, formatDateTimeLocal, formatMoney } from './utils';
import PpModal from './pagos/PpModal';
import { DocArchivo, DocPaper, DocPaso, DocPorQue } from './pagos/documentoUi';

/**
 * Notas de credito de las ventas deshechas, pendiente D de la revision contable (2026-10-08).
 * Pasados 6 meses desde la entrega la nota ya no rebaja el IVA (art. 21 N° 2 y art. 70 DL 825;
 * pregunta frecuente SII 001.130.1212).
 *
 * 9-oct: la tienda sube su nota en el detalle de la venta (app y market) y queda registrada al
 * instante. Aqui se revisan esas notas (y se rechazan con un motivo si no calzan), se registran las
 * de RepuesTop y, si hace falta, se registra a mano la de una tienda.
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

/** IVA de la nota: el monto es el total, IVA incluido. */
const IVA = 0.19;

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

/** Abre el pedido en Pedidos, filtrado por su numero (aunque este finalizado o sea de otro mes). */
function PedidoLink({ codigo, id }: { codigo: string | null; id: number | null }) {
  const numero = codigo ?? (id != null ? String(id) : null);
  if (!numero) return <>—</>;
  return (
    <Link className="profile-inline-link" to={`/administracion/pedidos?q=${encodeURIComponent(numero)}`} title="Ver el pedido">
      {pedidoLabel(codigo, id)}
    </Link>
  );
}

function estadoPendiente(p: CreditNotePending): { text: string; tone: string } {
  if (p.emisor === 'REPUESTOP') return { text: 'Pendiente de RepuesTop', tone: 'tone-blue' };
  if (p.estado === 'RECHAZADA') return { text: 'Rechazada: la tienda debe subirla de nuevo', tone: 'tone-red' };
  return { text: 'Pendiente de la tienda', tone: 'tone-amber' };
}

/** Algunos PDF se guardaron con el nombre codificado ("Adhesi%C3%B3n"): se muestra legible. */
function legible(texto: string): string {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

function netoEIva(total: number): { neto: number; iva: number } {
  const neto = Math.round(total / (1 + IVA));
  return { neto, iva: total - neto };
}

function NotasCreditoPanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CreditNoteDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [rechazo, setRechazo] = useState<{ nota: CreditNoteRegistered; motivo: string } | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [rechazoError, setRechazoError] = useState('');

  const panelQuery = useQuery({
    queryKey: ['admin-credit-notes'],
    queryFn: administrationApi.getCreditNotes,
  });
  const pendientes = panelQuery.data?.pendientes ?? [];
  const registradas = panelQuery.data?.registradas ?? [];
  const mediaciones = panelQuery.data?.mediacionesPorVencer ?? [];
  const criticas = pendientes.filter((p) => p.nivel === 'CRITICO').length;
  const vencidas = pendientes.filter((p) => p.nivel === 'VENCIDA').length;
  const deRepuestop = pendientes.filter((p) => p.emisor === 'REPUESTOP').length;

  function openDraft(pending: CreditNotePending): void {
    setDraftError('');
    const sugerido = pending.montoPropuesto ?? pending.montoReembolso;
    setDraft({
      pending,
      folio: '',
      fechaEmision: todayChile(),
      monto: sugerido != null ? String(Math.round(sugerido)) : '',
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
    const monto = draft.monto.trim() ? Number(draft.monto) : null;
    if (monto != null && draft.pending.montoMaximo != null && monto > draft.pending.montoMaximo) {
      setDraftError(`El monto no puede superar ${formatMoney(draft.pending.montoMaximo)}.`);
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
        monto,
      }, draft.archivo);
      await queryClient.invalidateQueries({ queryKey: ['admin-credit-notes'] });
      setDraft(null);
    } catch (error) {
      setDraftError(mensajeDeError(error, 'No se pudo registrar la nota de crédito.'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmarRechazo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!rechazo || rechazando) return;
    if (!rechazo.motivo.trim()) {
      setRechazoError('Indica el motivo: la tienda lo ve en el detalle de su venta.');
      return;
    }
    setRechazando(true);
    setRechazoError('');
    try {
      await administrationApi.rejectCreditNote(rechazo.nota.id, rechazo.motivo.trim());
      await queryClient.invalidateQueries({ queryKey: ['admin-credit-notes'] });
      setRechazo(null);
    } catch (error) {
      setRechazoError(mensajeDeError(error, 'No se pudo rechazar la nota de crédito.'));
    } finally {
      setRechazando(false);
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

  const montoDraft = draft && draft.monto.trim() ? Number(draft.monto) : null;
  const referenciaDraft = draft ? (draft.pending.emisor === 'TIENDA' ? draft.pending.montoReembolso : draft.pending.montoPropuesto) : null;

  return (
    <>
      {panelQuery.isError && (
        <QueryErrorNotice error={panelQuery.error} what="las notas de crédito" onRetry={() => panelQuery.refetch()} />
      )}

      <div className="metric-grid compact">
        <MetricCard label="Notas pendientes" value={pendientes.length} tone="blue" iconName="receipt"
          description={`${pendientes.length - deRepuestop} de tiendas · ${deRepuestop} de RepuesTop`} />
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
          (art. 21 N° 2 y art. 70 DL 825). La <strong>tienda</strong> anula su boleta y sube la nota en el detalle de
          su venta (app o web): queda registrada al instante y aquí se revisa. <strong>RepuesTop</strong> anula su
          factura de comisión cuando el reembolso llegó después de liquidar el retiro; esa la registra el equipo.
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
                  <th>Pedido</th>
                  <th>Total venta</th>
                  <th>Reembolsado</th>
                  <th>Origen</th>
                  <th>Entrega / vence</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendientes.map((p) => {
                  const estado = estadoPendiente(p);
                  return (
                    <tr key={`${p.pagoReembolsoId}-${p.emisor}`}>
                      <td>
                        <PedidoLink codigo={p.codigoPedido} id={p.pedidoId} />
                        <div className="panel-hint">{p.nombreTienda ?? '—'}</div>
                      </td>
                      <td>{p.totalVenta != null ? formatMoney(p.totalVenta) : '—'}</td>
                      <td>
                        {p.montoReembolso != null ? formatMoney(p.montoReembolso) : '—'}
                        {p.porcentajeReembolsado != null && (
                          <div className="panel-hint">{p.porcentajeReembolsado === 100 ? 'Total' : `Parcial · ${p.porcentajeReembolsado}%`}</div>
                        )}
                      </td>
                      <td>
                        {p.origen}
                        {p.mediacionId != null && (
                          <div>
                            <Link className="profile-inline-link" to={`/confianza/mediations/${p.mediacionId}`}>Ver caso #{p.mediacionId}</Link>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="panel-hint">
                          {p.fechaEntrega ? `Entrega ${formatDate(p.fechaEntrega)}` : 'Sin entrega'}
                        </div>
                        {formatDate(p.venceEl)}{' '}
                        <span className={`status-pill ${NIVEL_LABEL[p.nivel].tone}`}>{NIVEL_LABEL[p.nivel].text}</span>
                        <div className="panel-hint">
                          {p.diasRestantes >= 0 ? `${p.diasRestantes} días` : `hace ${-p.diasRestantes} días`}
                          {' · desde '}{p.tipoFechaBase === 'ENTREGA' ? 'la entrega' : p.tipoFechaBase === 'BOLETA' ? 'la boleta' : 'la factura'}
                          {p.devolucionFueraDePlazo && ' · devolución fuera de plazo'}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${estado.tone}`}>{estado.text}</span>
                        {p.motivoRechazo && <div className="panel-hint">Motivo: {p.motivoRechazo}</div>}
                        <div className="panel-hint">
                          Anula: {legible(p.documentoAnulado)}{p.codigoRetiro && ` (${p.codigoRetiro})`}
                        </div>
                      </td>
                      <td>
                        {p.emisor === 'REPUESTOP' ? (
                          <button className="primary-button" type="button" onClick={() => openDraft(p)}>
                            <UiIcon name="upload" /> Registrar
                          </button>
                        ) : (
                          <button className="secondary-button" type="button" onClick={() => openDraft(p)}
                            title="Si la tienda envió la nota por otro medio">
                            <UiIcon name="upload" /> Registrar a mano
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
                <tr><th>Vence el</th><th>Pedido</th><th>Caso</th><th>Tienda</th><th>Entrega</th></tr>
              </thead>
              <tbody>
                {mediaciones.map((m) => (
                  <tr key={m.mediacionId}>
                    <td>{formatDate(m.venceEl)}<div className="panel-hint">{m.diasRestantes >= 0 ? `${m.diasRestantes} días` : 'vencida'}</div></td>
                    <td><PedidoLink codigo={m.codigoPedido} id={m.pedidoId} /></td>
                    <td><Link className="profile-inline-link" to={`/confianza/mediations/${m.mediacionId}`}>#{m.mediacionId}</Link></td>
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
                <tr><th>Emisión</th><th>Folio</th><th>Emite</th><th>Pedido</th><th>Monto</th><th>Registrada</th><th /></tr>
              </thead>
              <tbody>
                {registradas.map((n) => (
                  <tr key={n.id}>
                    <td>
                      {formatDate(n.fechaEmision)}
                      {n.emitidaFueraDePlazo && <div><span className="status-pill tone-red">Fuera de plazo</span></div>}
                    </td>
                    <td>{n.folio}</td>
                    <td>
                      {EMISOR_LABEL[n.emisor]}
                      {n.emisor === 'TIENDA' && (
                        <div className="panel-hint">{n.origen === 'TIENDA' ? 'Registrada por la tienda' : 'Registrada a mano'}</div>
                      )}
                    </td>
                    <td>
                      <PedidoLink codigo={n.codigoPedido} id={n.pedidoId} />
                      <div className="panel-hint">{n.nombreTienda ?? '—'}</div>
                    </td>
                    <td>
                      {n.monto != null ? formatMoney(n.monto) : '—'}
                      {n.emisor === 'TIENDA' && n.monto != null && n.montoReembolso != null && Math.round(n.monto) !== Math.round(n.montoReembolso) && (
                        <div className="panel-hint">Reembolso: {formatMoney(n.montoReembolso)}</div>
                      )}
                    </td>
                    <td>{formatDateTimeLocal(n.registradaAt)}{n.registradaPor && <div className="panel-hint">{n.registradaPor}</div>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {n.tieneArchivo && (
                          <button className="action-button neutral" type="button" onClick={() => void openPdf(n.id)} title="Ver PDF">
                            <UiIcon name="eye" />
                          </button>
                        )}
                        {n.emisor === 'TIENDA' && (
                          <button className="action-button delete" type="button" title="Rechazar: la tienda debe subirla de nuevo"
                            onClick={() => { setRechazoError(''); setRechazo({ nota: n, motivo: '' }); }}>
                            <UiIcon name="close" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 14-oct: mismo formato que la boleta de tarifa de servicio: a la izquierda la nota tal como
          queda y por qué es ese monto; a la derecha emitirla y registrarla. */}
      {draft && (() => {
        const p = draft.pending;
        const deRepuestop = p.emisor === 'REPUESTOP';
        const monto = montoDraft ?? 0;
        const { neto, iva } = netoEIva(monto);
        const superaTope = montoDraft != null && p.montoMaximo != null && montoDraft > p.montoMaximo;
        return (
          <PpModal
            title="Registrar nota de crédito"
            subtitle={<>Pedido <strong>{pedidoLabel(p.codigoPedido, p.pedidoId)}</strong> · {p.nombreTienda ?? '—'}</>}
            badge={<span className={`status-pill ${NIVEL_LABEL[p.nivel].tone}`}>{NIVEL_LABEL[p.nivel].text}</span>}
            onClose={() => !saving && setDraft(null)}
            width={1040}
            closeDisabled={saving}
            className="boleta-modal"
          >
            <form className="boleta-layout" onSubmit={saveDraft}>
              <aside className="boleta-doc">
                <DocPaper
                  kicker="Documento a registrar"
                  titulo="Nota de crédito electrónica"
                  estado={{ texto: `Vence ${formatDate(p.venceEl)}`, sub: p.diasRestantes >= 0 ? `${p.diasRestantes} días` : 'Vencida', tono: p.diasRestantes >= 0 ? 'pending' : 'info' }}
                  emisor={deRepuestop ? 'RepuesTop' : (p.nombreTienda ?? 'Tienda')}
                  receptor={deRepuestop ? (p.nombreTienda ?? 'Tienda') : 'Comprador del pedido'}
                  extra={[{ label: 'Anula', value: legible(p.documentoAnulado) }]}
                  lineas={[{ concepto: deRepuestop ? 'Anula la comisión facturada por lo reembolsado' : 'Anula la venta por lo reembolsado', monto: neto }]}
                  totales={[{ label: 'Monto neto', value: formatMoney(neto) }, { label: 'IVA 19%', value: formatMoney(iva) }]}
                  total={{ label: 'Total de la nota', monto }}
                />
                <DocPorQue
                  texto={deRepuestop
                    ? <>Se le devolvió plata al comprador. RepuesTop anula la <strong>comisión</strong> que le facturó a la tienda por ese monto (con IVA), no la venta{p.montoMaximo != null ? <>, con tope en el total de la factura ({formatMoney(p.montoMaximo)})</> : null}.</>
                    : <>La tienda anula su boleta o factura por lo que se le devolvió al comprador, IVA incluido.</>}
                  filas={[
                    ...(p.totalVenta != null ? [{ label: 'Venta de la tienda', monto: p.totalVenta }] : []),
                    ...(p.montoReembolso != null ? [{ label: `Reembolsado al comprador${p.porcentajeReembolsado != null ? ` (${p.porcentajeReembolsado}%)` : ''}`, monto: p.montoReembolso, tipo: deRepuestop ? undefined : ('result' as const) }] : []),
                    ...(deRepuestop && p.montoPropuesto != null ? [{ label: 'Nota propuesta (comisión con IVA)', monto: p.montoPropuesto, tipo: 'result' as const }] : []),
                  ]}
                />
              </aside>

              <div className="boleta-main">
                <DocPaso
                  n={1}
                  titulo={deRepuestop ? 'Emite la nota en el SII' : 'La tienda emite la nota'}
                  descripcion={<>Emite <strong>{EMISOR_LABEL[p.emisor]}</strong>, referenciando {legible(p.documentoAnulado)}. Hay plazo hasta el <strong>{formatDate(p.venceEl)}</strong> (6 meses): después ya no rebaja el IVA.</>}
                >
                  {p.devolucionFueraDePlazo ? (
                    <div className="boleta-callout is-warn"><UiIcon name="alert" /><span>La devolución ocurrió después de los 6 meses: la nota queda como respaldo, pero el IVA ya no se recupera.</span></div>
                  ) : (
                    <div className="boleta-callout"><UiIcon name="info" /><span>Reembolso {p.montoReembolso != null ? formatMoney(p.montoReembolso) : '—'}{p.fechaReembolso ? ` del ${formatDate(p.fechaReembolso)}` : ''}.</span></div>
                  )}
                </DocPaso>

                <DocPaso n={2} titulo="Registra la nota emitida" descripcion="Folio, fecha, monto total (IVA incluido) y el PDF.">
                  <div className="boleta-fields">
                    <label className="form-field">
                      <span>Folio asignado por el SII</span>
                      <input className="input" type="text" inputMode="numeric" pattern="[0-9]+" required placeholder="Ej: 512"
                        value={draft.folio} onChange={(event) => setDraft({ ...draft, folio: event.target.value })} />
                    </label>
                    <label className="form-field">
                      <span>Fecha de emisión</span>
                      <input className="input" type="date" max={todayChile()} required
                        value={draft.fechaEmision} onChange={(event) => setDraft({ ...draft, fechaEmision: event.target.value })} />
                    </label>
                    <label className="form-field is-wide">
                      <span>Monto total de la nota (IVA incluido)</span>
                      <input className="input" type="number" min="1" step="1" max={p.montoMaximo ?? undefined}
                        value={draft.monto} onChange={(event) => setDraft({ ...draft, monto: event.target.value })} />
                      {montoDraft != null && montoDraft > 0 && <small className="boleta-hint">Neto {formatMoney(neto)} + IVA {formatMoney(iva)}</small>}
                    </label>
                    <DocArchivo nombre={draft.archivo?.name ?? ''} onFile={(file) => setDraft({ ...draft, archivo: file })} required titulo="Adjunta el PDF de la nota de crédito" />
                  </div>
                </DocPaso>

                {superaTope && (
                  <div className="notice notice-error"><UiIcon name="alert" /> El monto supera el tope de {formatMoney(p.montoMaximo!)}.</div>
                )}
                {montoDraft != null && referenciaDraft != null && Math.round(montoDraft) !== Math.round(referenciaDraft) && !superaTope && (
                  <div className="notice">
                    <UiIcon name="alert" />
                    {p.emisor === 'TIENDA'
                      ? ` El monto es distinto de lo reembolsado (${formatMoney(referenciaDraft)}). Revisa que coincida con el PDF.`
                      : ` El monto es distinto de la comisión propuesta (${formatMoney(referenciaDraft)}). Revisa que coincida con el PDF.`}
                  </div>
                )}
                {draft.fechaEmision > p.venceEl && (
                  <div className="notice"><UiIcon name="alert" /> La fecha de emisión es posterior al vencimiento: la nota queda como respaldo, pero ya no rebaja el IVA.</div>
                )}
                {draftError && <div className="notice notice-error">{draftError}</div>}

                <div className="boleta-actions">
                  <button className="secondary-button" type="button" onClick={() => setDraft(null)} disabled={saving}>Cancelar</button>
                  <button className="primary-button" type="submit" disabled={saving}><UiIcon name="check" />{saving ? 'Guardando…' : 'Registrar nota'}</button>
                </div>
              </div>
            </form>
          </PpModal>
        );
      })()}

      <Modal isOpen={rechazo !== null} onClose={() => setRechazo(null)} title="Rechazar nota de crédito">
        {rechazo && (
          <form className="form-grid" onSubmit={confirmarRechazo}>
            <p className="panel-hint" style={{ gridColumn: '1 / -1' }}>
              Folio <strong>{rechazo.nota.folio}</strong> del pedido{' '}
              <strong>{pedidoLabel(rechazo.nota.codigoPedido, rechazo.nota.pedidoId)}</strong> · {rechazo.nota.nombreTienda ?? '—'}.
              {' '}Vuelve a quedar pendiente y la tienda recibe un aviso con el motivo para subirla de nuevo.
            </p>
            <label className="form-field" style={{ gridColumn: '1 / -1' }}>
              <span>Motivo (lo ve la tienda)</span>
              <textarea className="input" rows={3} maxLength={500} required
                placeholder="Ej.: el monto del PDF no coincide con lo reembolsado"
                value={rechazo.motivo} onChange={(event) => setRechazo({ ...rechazo, motivo: event.target.value })} />
            </label>
            {rechazoError && <div className="notice notice-error" style={{ gridColumn: '1 / -1' }}>{rechazoError}</div>}
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setRechazo(null)}>Cancelar</button>
              <button className="danger-button" type="submit" disabled={rechazando}>{rechazando ? 'Rechazando…' : 'Rechazar nota'}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/**
 * Notas de credito de las ventas deshechas (plazo de 6 meses, art. 21 N° 2 y art. 70 DL 825). La
 * alerta de las 08:05 enlaza aqui con ?tab=notas.
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
