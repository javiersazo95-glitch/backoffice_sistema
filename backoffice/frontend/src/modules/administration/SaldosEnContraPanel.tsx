import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as administrationApi from '@/api/administration';
import type { CargoTienda, EstadoCargoTienda } from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import MetricCard from '@/components/shared/MetricCard';
import Modal from '@/components/shared/Modal';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import UiIcon from '@/components/shared/UiIcon';
import { formatOrderNumber } from '@/utils/orderNumber';
import { formatDate, formatDateTimeLocal, formatMoney } from './utils';

const ESTADO_LABEL: Record<EstadoCargoTienda, { text: string; tone: string }> = {
  PENDIENTE: { text: 'Pendiente', tone: 'tone-amber' },
  DESCONTADO: { text: 'Descontado', tone: 'tone-green' },
  COBRADO: { text: 'Cobrado', tone: 'tone-green' },
  ANULADO: { text: 'Anulado', tone: 'tone-gray' },
};

/**
 * Pago a proveedores → Saldos en contra (12-oct): reembolsos de ventas que ya se le habian pagado
 * a la tienda (un reclamo por garantia resuelto despues del retiro). Se descuentan solos del
 * proximo retiro de la tienda; si en 30 dias no se descontaron, se cobran por transferencia y se
 * marcan aqui.
 */
export default function SaldosEnContraPanel() {
  const queryClient = useQueryClient();
  const [cobrando, setCobrando] = useState<{ cargo: CargoTienda; nota: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargosQuery = useQuery({ queryKey: ['admin-store-charges'], queryFn: administrationApi.getStoreCharges });
  const cargos = cargosQuery.data ?? [];
  const pendientes = cargos.filter((c) => c.estado === 'PENDIENTE');
  const paraCobrar = pendientes.filter((c) => c.paraCobrar);
  const totalPendiente = pendientes.reduce((acc, c) => acc + Number(c.monto || 0), 0);

  async function marcarCobrado(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!cobrando || guardando) return;
    if (!cobrando.nota.trim()) {
      setError('Indica cómo se cobró (por ejemplo, el número de la transferencia).');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await administrationApi.collectStoreCharge(cobrando.cargo.id, cobrando.nota.trim());
      await queryClient.invalidateQueries({ queryKey: ['admin-store-charges'] });
      setCobrando(null);
    } catch (cause) {
      setError(mensajeDeError(cause, 'No se pudo marcar el cargo como cobrado.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      {cargosQuery.isError && (
        <QueryErrorNotice error={cargosQuery.error} what="los saldos en contra" onRetry={() => cargosQuery.refetch()} />
      )}

      <div className="metric-grid compact" style={{ marginBottom: '20px' }}>
        <MetricCard label="Por descontar" value={formatMoney(totalPendiente)} tone="amber" iconName="wallet"
          description={`${pendientes.length} cargos pendientes en ${new Set(pendientes.map((c) => c.proveedorId)).size} tiendas`} />
        <MetricCard label="Para cobrar" value={paraCobrar.length} tone="red" iconName="alert"
          description="Más de 30 días sin descontarse: cobrar por transferencia" />
      </div>

      <div className="notice" style={{ marginBottom: '15px' }}>
        <UiIcon name="info" />
        <span>
          Cuando un reclamo termina en reembolso y esa venta <strong>ya se le había pagado</strong> a la tienda, lo que se le
          pagó de más (lo devuelto, menos la comisión que se le reintegra, más el cargo de Flow por el reembolso) queda aquí.
          Se descuenta solo de su <strong>próximo retiro</strong>; la tienda lo ve en Retiros → Cargos. Si en 30 días no se
          descontó, pídele la transferencia y márcalo cobrado.
        </span>
      </div>

      <section className="table-shell">
        <div className="table-toolbar"><h2>Saldos en contra de tiendas</h2></div>
        {cargosQuery.isLoading ? (
          <p className="panel-hint">Cargando…</p>
        ) : cargos.length === 0 ? (
          <p className="panel-hint">No hay saldos en contra.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="wide-table">
              <thead>
                <tr><th>Tienda</th><th>Pedido</th><th>Reembolso</th><th>Cargo</th><th>Generado</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                {cargos.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nombreTienda ?? '—'}</td>
                    <td>
                      <Link className="profile-inline-link" to={`/administracion/pedidos?q=${encodeURIComponent(c.numeroPedido ?? String(c.pedidoId))}`}>
                        {c.numeroPedido ? formatOrderNumber(c.numeroPedido) : `#${c.pedidoId}`}
                      </Link>
                    </td>
                    <td>{c.reembolso != null ? formatMoney(c.reembolso) : '—'}</td>
                    <td><strong>{formatMoney(c.monto)}</strong></td>
                    <td>
                      {formatDate(c.createdAt)}
                      {c.estado === 'PENDIENTE' && <div className="panel-hint">{c.diasPendiente} días</div>}
                    </td>
                    <td>
                      <span className={`status-pill ${c.paraCobrar ? 'tone-red' : ESTADO_LABEL[c.estado].tone}`}>
                        {c.paraCobrar ? 'Para cobrar' : ESTADO_LABEL[c.estado].text}
                      </span>
                      {c.estado === 'DESCONTADO' && c.codigoRetiroDescuento && (
                        <div className="panel-hint">En {c.codigoRetiroDescuento}</div>
                      )}
                      {c.estado === 'COBRADO' && (
                        <div className="panel-hint">{c.notaCobro}{c.cobradoAt && ` · ${formatDateTimeLocal(c.cobradoAt)}`}</div>
                      )}
                      {c.estado === 'ANULADO' && c.motivoAnulacion && <div className="panel-hint">{c.motivoAnulacion}</div>}
                    </td>
                    <td>
                      {c.estado === 'PENDIENTE' && (
                        <button className="secondary-button" type="button"
                          onClick={() => { setError(''); setCobrando({ cargo: c, nota: '' }); }}>
                          <UiIcon name="check" /> Marcar cobrado
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

      <Modal isOpen={cobrando !== null} onClose={() => setCobrando(null)} title="Marcar cargo cobrado">
        {cobrando && (
          <form className="form-grid" onSubmit={marcarCobrado}>
            <p className="panel-hint" style={{ gridColumn: '1 / -1' }}>
              <strong>{cobrando.cargo.nombreTienda}</strong> transfirió {formatMoney(cobrando.cargo.monto)} por el pedido{' '}
              {cobrando.cargo.numeroPedido ? formatOrderNumber(cobrando.cargo.numeroPedido) : `#${cobrando.cargo.pedidoId}`}. Deja de
              descontarse de sus retiros.
            </p>
            <label className="form-field" style={{ gridColumn: '1 / -1' }}>
              <span>Cómo se cobró</span>
              <input className="input" type="text" maxLength={500} required placeholder="Ej.: transferencia N° 123456 del 15-10"
                value={cobrando.nota} onChange={(event) => setCobrando({ ...cobrando, nota: event.target.value })} />
            </label>
            {error && <div className="notice notice-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setCobrando(null)}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Marcar cobrado'}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
