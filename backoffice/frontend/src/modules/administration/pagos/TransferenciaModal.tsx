import { useQuery } from '@tanstack/react-query';
import * as adminApi from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import { formatDateTimeLocal, formatMoney } from '../utils';
import type { DatosTransferencia, RetiroAdminResponse } from '../types';
import PpModal from './PpModal';
import CopyField, { CopyButton } from './CopyField';

export const DATOS_TRANSFERENCIA_KEY = 'admin-datos-transferencia';

/** Texto plano con la ficha completa, por si el operador prefiere pegarla entera en un bloc. */
function fichaComoTexto(d: DatosTransferencia): string {
  return [
    `Destinatario BCI (alias): ${d.aliasSugerido}`,
    `Tienda: ${d.nombreTienda}`,
    `Banco: ${d.banco ?? ''}${d.bankCode ? ` (código ${d.bankCode})` : ''}`,
    `Tipo de cuenta: ${d.tipoCuenta ?? ''}`,
    `N° de cuenta: ${d.numeroCuenta ?? ''}`,
    `RUT titular: ${d.rutTitular ?? ''}`,
    `Nombre titular: ${d.titular ?? ''}`,
    `Correo de aviso: ${d.emailAviso ?? ''}`,
    ...(d.bancoRequiereAlias ? [`Cuenta inscrita como (alias): ${d.aliasInscrito ?? ''}`] : []),
    `Monto: ${d.montoEntero}`,
    `Glosa: ${d.glosa}`,
  ].join('\n');
}

/**
 * Popup con los datos bancarios para transferir un retiro a mano en BCI (13-oct). Cada dato se
 * copia con un clic, en crudo, para que no haya nada que tipear. Dice si es la primera vez que se
 * le paga a la tienda (hay que inscribir el destinatario) o la N-esima (buscarlo por el alias), y
 * trae las advertencias que calcula el servidor: datos cambiados desde el ultimo pago, ultimo pago
 * rebotado, boleta pendiente, fondos retenidos.
 */
export default function TransferenciaModal({
  retiro,
  onClose,
  onCargarBoleta,
  onMarcarTransferido,
}: {
  retiro: RetiroAdminResponse;
  onClose: () => void;
  onCargarBoleta: () => void;
  onMarcarTransferido: (datos: DatosTransferencia) => void;
}) {
  const { data, isLoading, isError, error } = useQuery<DatosTransferencia>({
    queryKey: [DATOS_TRANSFERENCIA_KEY, retiro.retiroId],
    queryFn: () => adminApi.getDatosTransferencia(retiro.retiroId),
  });

  const puedeMarcar = Boolean(data && data.documentoCompleto && data.datosBancariosCompletos && !data.fondosRetenidos && data.estado === 'SOLICITADO');
  const motivoBloqueo = !data ? ''
    : data.estado !== 'SOLICITADO' ? `Este retiro ya está en ${data.estado}.`
      : data.fondosRetenidos ? 'Fondos retenidos: no se puede pagar.'
        : !data.datosBancariosCompletos ? 'La tienda no tiene registrados todos sus datos bancarios.'
          : !data.documentoCompleto ? 'Primero carga la boleta o factura de comisión.'
            : '';

  return (
    <PpModal
      title={<>Transferir a <FounderSellerName name={retiro.nombreTienda} founder={retiro.sellerFounder} /></>}
      subtitle={<>Retiro <strong>{retiro.codigoRetiro || '—'}</strong> · solicitado el {formatDateTimeLocal(retiro.fecha)}</>}
      badge={data && (
        data.primeraTransferencia
          ? <span className="status-pill tone-amber">Primera transferencia · inscribir destinatario</span>
          : <span className="status-pill tone-green">Pago N° {data.vecesPagado + 1} · destinatario ya inscrito</span>
      )}
      onClose={onClose}
      width={640}
      className="pp-transfer-modal"
    >
      {isLoading && <div className="loading-cell">Cargando datos bancarios…</div>}
      {isError && (
        <div className="notice error"><UiIcon name="alert" />{mensajeDeError(error, 'No se pudieron cargar los datos de la transferencia.')}</div>
      )}
      {data && (
        <>
          <div className="pp-transfer-alias">
            <div>
              <span className="pp-transfer-alias-label">
                {data.primeraTransferencia ? 'Inscribe el destinatario en BCI con el alias' : 'Busca el destinatario en BCI por el alias'}
              </span>
              <strong className="pp-transfer-alias-value">{data.aliasSugerido}</strong>
              <span className="pp-transfer-alias-hint">
                {data.primeraTransferencia
                  ? 'Nunca se le ha transferido a esta tienda: crea el destinatario con este alias y revisa cada dato antes de guardarlo.'
                  : data.ultimoPagoAt
                    ? `Último pago el ${formatDateTimeLocal(data.ultimoPagoAt)}${data.ultimoPagoEstado === 'RECHAZADO' ? ' (rebotó)' : ''}. No crees un destinatario nuevo.`
                    : 'No crees un destinatario nuevo.'}
              </span>
            </div>
            <CopyButton text={data.aliasSugerido} label="Copiar alias" title="Copiar alias" className="pp-copy-button--solid" />
          </div>

          {data.advertencias.length > 0 && (
            <ul className={`pp-transfer-warnings${data.fondosRetenidos || !data.documentoCompleto || !data.datosBancariosCompletos ? ' is-blocking' : ''}`}>
              {data.advertencias.map((aviso) => (
                <li key={aviso}><UiIcon name="alert" /><span>{aviso}</span></li>
              ))}
            </ul>
          )}

          <div className="pp-transfer-grid">
            <CopyField label="Banco" value={<>{data.banco ?? ''}{data.bankCode ? <small> · código {data.bankCode}</small> : null}</>} copyValue={data.banco} mono={false} />
            <CopyField label="Tipo de cuenta" value={data.tipoCuenta} copyValue={data.tipoCuenta} mono={false} />
            <CopyField label="N° de cuenta" value={data.numeroCuenta} copyValue={data.numeroCuenta} emphasis />
            <CopyField label="RUT del titular" value={data.rutTitular} copyValue={data.rutTitular} emphasis />
            <CopyField label="Nombre del titular" value={data.titular} copyValue={data.titular} mono={false} />
            <CopyField label="Correo de aviso" value={data.emailAviso} copyValue={data.emailAviso} mono={false} />
            {data.bancoRequiereAlias && (
              <CopyField
                label="Cuenta inscrita como (alias del banco)"
                value={data.aliasInscrito}
                copyValue={data.aliasInscrito}
                hint={`${data.banco} inscribe la cuenta por RUT, correo o teléfono.`}
              />
            )}
            <CopyField
              label="Monto a transferir"
              value={<strong>{formatMoney(data.monto)}</strong>}
              copyValue={data.montoEntero}
              hint={<>Se copia <code>{data.montoEntero}</code>, sin puntos ni símbolo.</>}
              emphasis
            />
            <CopyField label="Glosa / mensaje al destinatario" value={data.glosa} copyValue={data.glosa} mono={false} />
          </div>

          <footer className="pp-transfer-actions">
            <CopyButton text={fichaComoTexto(data)} label="Copiar todo" title="Copiar la ficha completa como texto" />
            <div className="pp-transfer-actions-main">
              {!data.documentoCompleto && (
                <button type="button" className="secondary-button" onClick={onCargarBoleta}>
                  <UiIcon name="receipt" /> Cargar boleta
                </button>
              )}
              <button
                type="button"
                className="primary-button"
                disabled={!puedeMarcar}
                title={puedeMarcar ? 'Ya transferí en BCI: registrar el pago' : motivoBloqueo}
                onClick={() => onMarcarTransferido(data)}
              >
                <UiIcon name="check" /> Marcar como transferido
              </button>
            </div>
          </footer>
          {!puedeMarcar && motivoBloqueo && <p className="pp-transfer-blocked">{motivoBloqueo}</p>}
        </>
      )}
    </PpModal>
  );
}
