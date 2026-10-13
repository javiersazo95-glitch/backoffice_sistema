import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminApi from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import { formatDate, formatMoney } from '../utils';
import type { DatosTransferencia, PagoProveedorResponse, RetiroAdminResponse } from '../types';
import PpModal from './PpModal';
import { DATOS_TRANSFERENCIA_KEY } from './TransferenciaModal';

export function codigoPag(pagoId: number): string {
  return `PAG-${String(pagoId).padStart(6, '0')}`;
}

/**
 * Confirmacion de "ya transferí" (13-oct). Pide el numero de operacion de BCI (obligatorio: queda
 * en el historial y en el correo al vendedor, y el backend no deja registrarlo dos veces) y una
 * confirmacion explicita del monto. Al confirmar, el retiro pasa al PAG del dia.
 */
export default function ConfirmarTransferenciaModal({
  retiro,
  datos: datosIniciales,
  onClose,
  onPaid,
}: {
  retiro: RetiroAdminResponse;
  datos?: DatosTransferencia | null;
  onClose: () => void;
  onPaid: (pago: PagoProveedorResponse) => void;
}) {
  const queryClient = useQueryClient();
  const { data: datosCargados } = useQuery<DatosTransferencia>({
    queryKey: [DATOS_TRANSFERENCIA_KEY, retiro.retiroId],
    queryFn: () => adminApi.getDatosTransferencia(retiro.retiroId),
    enabled: !datosIniciales,
  });
  const datos = datosIniciales ?? datosCargados ?? null;
  const [referencia, setReferencia] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const bloqueado = datos ? (!datos.documentoCompleto || !datos.datosBancariosCompletos || datos.fondosRetenidos || datos.estado !== 'SOLICITADO') : false;
  const listo = referencia.trim().length > 0 && confirmado && !bloqueado && !guardando;

  const confirmar = async () => {
    if (!listo) return;
    setGuardando(true);
    setError('');
    try {
      const pago = await adminApi.payWithdrawalByTransfer(retiro.retiroId, referencia.trim());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-withdrawal-payments'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-withdrawal-payment'] }),
        queryClient.invalidateQueries({ queryKey: [DATOS_TRANSFERENCIA_KEY] }),
      ]);
      const dia = pago.fechaPagoDia ? formatDate(pago.fechaPagoDia) : formatDate(pago.fechaPago);
      showToast(`${retiro.codigoRetiro || 'Retiro'} registrado en ${codigoPag(pago.pagoId)} (transferencias del ${dia}). Se avisó al vendedor por correo.`);
      onPaid(pago);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo registrar el pago.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <PpModal
      title="Registrar transferencia"
      subtitle={<>Retiro <strong>{retiro.codigoRetiro || '—'}</strong> · {retiro.nombreTienda}</>}
      onClose={onClose}
      width={520}
      zIndex={1100}
      closeDisabled={guardando}
      className="pp-confirm-modal"
    >
      <dl className="pp-confirm-summary">
        <dt>Monto</dt><dd><strong>{formatMoney(datos?.monto ?? retiro.monto)}</strong></dd>
        <dt>Destinatario (alias)</dt><dd>{datos?.aliasSugerido ?? '—'}</dd>
        <dt>Banco</dt><dd>{datos?.banco ?? retiro.banco}</dd>
        <dt>Cuenta</dt><dd>{datos?.tipoCuenta ?? retiro.tipoCuenta} · {datos?.numeroCuenta ?? retiro.numeroCuenta}</dd>
        <dt>Titular</dt><dd>{datos?.titular ?? retiro.razonSocial} · {datos?.rutTitular ?? retiro.rut}</dd>
      </dl>

      {bloqueado && datos && (
        <div className="notice error">
          <UiIcon name="alert" />
          {datos.estado !== 'SOLICITADO'
            ? `Este retiro ya está en ${datos.estado}.`
            : datos.fondosRetenidos
              ? `Fondos retenidos: ${datos.motivoRetencion ?? 'tienda suspendida'}.`
              : !datos.datosBancariosCompletos
                ? 'La tienda no tiene registrados todos sus datos bancarios: no hay a dónde transferir.'
                : 'Falta la boleta o factura de comisión: cárgala antes de registrar el pago.'}
        </div>
      )}

      <label className="form-field">
        <span>N° de operación o comprobante de BCI (obligatorio)</span>
        <input
          className="input"
          type="text"
          value={referencia}
          onChange={(event) => { setReferencia(event.target.value); setError(''); }}
          placeholder="Ej: 0123456789"
          maxLength={60}
          autoFocus
          disabled={guardando || bloqueado}
        />
        <small>Aparece en el comprobante que muestra BCI al terminar la transferencia. Queda en el historial y en el correo al vendedor.</small>
      </label>

      <label className={`pp-confirm-check${confirmado ? ' is-checked' : ''}`}>
        <input type="checkbox" checked={confirmado} onChange={(event) => setConfirmado(event.target.checked)} disabled={guardando || bloqueado} />
        <span>Confirmo que la transferencia en BCI quedó <strong>exitosa</strong> por <strong>{formatMoney(datos?.monto ?? retiro.monto)}</strong> a este destinatario.</span>
      </label>

      <p className="pp-reject-hint">
        Al confirmar, el retiro pasa al pago del día y el vendedor recibe un correo con el detalle y la boleta adjunta.
        Si después rebota, se marca desde "Transferidos hoy" o el historial.
      </p>
      {error && <p role="alert" className="pp-confirm-error">{error}</p>}

      <footer className="pp-reject-actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={guardando}>Cancelar</button>
        <button type="button" className="primary-button" onClick={() => void confirmar()} disabled={!listo}>
          {guardando ? 'Registrando…' : 'Sí, ya transferí'}
        </button>
      </footer>
    </PpModal>
  );
}
