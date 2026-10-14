import { useEffect, useMemo, useState, type FormEvent } from 'react';
import * as adminApi from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import { chileDay, formatDate, formatDateTimeLocal, formatMoney } from '../utils';
import type { RetiroAdminResponse } from '../types';
import PpModal from './PpModal';
import { DocArchivo, DocPaper, DocPaso, DocPorQue, DocTipoSelector } from './documentoUi';
import { useDesglose } from '../desglose/DesgloseModal';
import { useRetiroDesglose, type RetiroRef } from '../desglose/useRetiroDesglose';

interface Borrador {
  type: string;
  rut: string;
  razonSocial: string;
  email: string;
  detalle: string;
  iva: string;
  folio: string;
  fechaEmision: string;
  pdfName: string;
  pdfFile?: File;
}

function todayChile(): string {
  return chileDay(new Date().toISOString());
}

/**
 * 14-oct: el documento a emitir, como se verá en el SII: tipo, receptor, conceptos, neto, IVA y
 * total. Debajo, por qué es ese monto (ventas del retiro − boleta = lo que recibe la tienda).
 */
function DocumentoAEmitir({
  retiro,
  factura,
  tipo,
  receptor,
  rut,
  emitido,
}: {
  retiro: RetiroAdminResponse;
  factura: adminApi.FacturaComision;
  tipo: string;
  receptor: string;
  rut: string;
  /** Folio y fecha cuando el documento ya está registrado. */
  emitido?: { folio: string; fecha: string };
}) {
  const abrir = useDesglose();
  const ref = useMemo<RetiroRef>(() => ({
    retiroId: retiro.retiroId,
    monto: retiro.monto,
    nombreTienda: retiro.nombreTienda,
    codigoRetiro: retiro.codigoRetiro,
    proveedorId: retiro.proveedorId,
  }), [retiro.retiroId, retiro.monto, retiro.nombreTienda, retiro.codigoRetiro, retiro.proveedorId]);
  const { desglose } = useRetiroDesglose(ref);
  const ventas = desglose?.ventas?.length ? desglose.venta.total : null;
  const saldos = desglose?.recibe?.lineas.find((linea) => linea.concepto.startsWith('Saldos en contra'))?.monto ?? 0;

  const textoSii = [
    `${tipo} electrónica`,
    `Receptor: ${receptor}`,
    rut ? `RUT: ${rut}` : null,
    '',
    ...factura.lineas.map((linea) => `${linea.concepto}: neto ${formatMoney(linea.neto)}`),
    `Neto: ${formatMoney(factura.neto)}`,
    `IVA 19%: ${formatMoney(factura.iva)}`,
    `Total: ${formatMoney(factura.total)}`,
  ].filter((linea) => linea !== null).join('\n');

  return (
    <aside className="boleta-doc">
      <DocPaper
        kicker={emitido ? 'Documento emitido' : 'Documento a emitir'}
        titulo={`${tipo} electrónica`}
        estado={emitido ? { texto: `Folio ${emitido.folio || '—'}`, sub: emitido.fecha ? formatDate(emitido.fecha) : undefined, tono: 'done' } : { texto: 'Sin emitir', tono: 'pending' }}
        emisor="RepuesTop"
        receptor={receptor}
        receptorDetalle={rut}
        lineas={factura.lineas.map((linea) => ({ concepto: linea.concepto, monto: linea.neto }))}
        totales={[{ label: 'Monto neto', value: formatMoney(factura.neto) }, { label: 'IVA 19%', value: formatMoney(factura.iva) }]}
        total={{ label: 'Total', monto: factura.total }}
        copiar={emitido ? undefined : { texto: textoSii }}
      />
      <DocPorQue
        texto="Es lo que RepuesTop le cobró a la tienda en este retiro: la comisión de servicio y el cargo por procesamiento de pago, cada uno con su IVA."
        filas={[
          ...(ventas !== null ? [{ label: 'Ventas del retiro', monto: ventas }] : []),
          { label: 'Boleta (cobro RepuesTop)', monto: factura.total, tipo: ventas !== null ? 'minus' as const : undefined },
          ...(saldos > 0 ? [{ label: 'Saldos en contra', monto: saldos, tipo: 'minus' as const }] : []),
          { label: 'La tienda recibe', monto: retiro.monto, tipo: ventas !== null ? 'result' as const : undefined },
        ]}
        accion={<button type="button" className="desglose-link" onClick={() => abrir({ retiro: ref }, 'boleta', { completo: true })}>Ver desglose venta por venta</button>}
      />
    </aside>
  );
}

/**
 * Carga de la boleta o factura de comision de un retiro de PROVEEDOR desde Pago a proveedores
 * (13-oct). Pide lo mismo que Liquidaciones > En liquidacion y guarda por el mismo endpoint, asi
 * que la puerta de pago (documento completo: tipo, RUT, razon social, correo, detalle, folio, fecha
 * de emision y PDF) es identica; el backend la vuelve a exigir al marcar transferido.
 *
 * 14-oct: rediseño en dos columnas. A la izquierda el documento a emitir y su porqué; a la derecha
 * los pasos (emitir en el SII, datos del receptor, registrar folio y PDF).
 */
export default function DocumentoLiquidacionModal({
  retiro,
  onClose,
  onSaved,
  initialEditing = false,
}: {
  retiro: RetiroAdminResponse;
  onClose: () => void;
  onSaved: () => void;
  /** Abrir directo en el formulario aunque el documento ya este completo ("Editar"). */
  initialEditing?: boolean;
}) {
  const completo = Boolean(retiro.documentoLiquidacionCompleto);
  const [editando, setEditando] = useState(!completo || initialEditing);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [factura, setFactura] = useState<adminApi.FacturaComision | null>(null);
  const [facturaError, setFacturaError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [borrador, setBorrador] = useState<Borrador>(() => ({
    type: retiro.documentoLiquidacionTipo || (retiro.rut ? 'Factura' : 'Boleta'),
    rut: retiro.documentoLiquidacionRut || retiro.rut || '',
    razonSocial: retiro.documentoLiquidacionRazonSocial || retiro.razonSocial || '',
    email: retiro.documentoLiquidacionEmail || retiro.email || '',
    detalle: retiro.documentoLiquidacionDetalle || '',
    iva: retiro.documentoLiquidacionIva != null ? String(Math.round(retiro.documentoLiquidacionIva)) : '',
    folio: retiro.documentoLiquidacionFolio || '',
    fechaEmision: retiro.documentoLiquidacionFechaEmision || todayChile(),
    pdfName: retiro.documentoLiquidacionNombre || '',
  }));

  // Lineas e IVA de la factura: los calcula el servidor (Y, revision contable 8-oct).
  useEffect(() => {
    let vivo = true;
    adminApi.getFacturaComision(retiro.retiroId)
      .then((data) => {
        if (!vivo) return;
        setFactura(data);
        setBorrador((actual) => ({
          ...actual,
          iva: String(Math.round(data.iva)),
          detalle: actual.detalle || data.detalleSugerido,
        }));
      })
      .catch((err) => { if (vivo) setFacturaError(mensajeDeError(err, 'No se pudieron calcular los datos de la factura.')); });
    return () => { vivo = false; };
  }, [retiro.retiroId]);

  // Vista del PDF ya registrado.
  useEffect(() => {
    if (!completo || !retiro.documentoLiquidacionNombre) return;
    let url: string | null = null;
    adminApi.getLiquidationDocumentFile('PROVEEDOR', retiro.retiroId)
      .then((objectUrl) => { url = objectUrl; setPdfUrl(objectUrl); })
      .catch(() => setPdfUrl(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [completo, retiro.retiroId, retiro.documentoLiquidacionNombre]);

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const faltan = !borrador.rut.trim() || !borrador.razonSocial.trim() || !borrador.email.trim() || !borrador.detalle.trim() || !borrador.pdfName.trim();
    if (faltan) {
      window.alert('Completa RUT, razón social, correo y detalle, y adjunta el PDF de la boleta o factura: sin todo eso el retiro no se puede pagar.');
      return;
    }
    if (!borrador.folio.trim() || !borrador.fechaEmision) {
      window.alert('Ingresa el folio y la fecha de emisión que asignó el SII. Sin ellos el documento no se puede conciliar ni pagar el retiro.');
      return;
    }
    setGuardando(true);
    try {
      await adminApi.saveLiquidationDocument({
        tipoRetiro: 'PROVEEDOR',
        retiroId: retiro.retiroId,
        tipoDocumento: borrador.type.trim(),
        rut: borrador.rut.trim(),
        razonSocial: borrador.razonSocial.trim(),
        email: borrador.email.trim(),
        detalle: borrador.detalle.trim(),
        ivaLiquidado: borrador.iva.trim() ? Number(borrador.iva) : null,
        eliminarDocumento: false,
        folio: borrador.folio.trim(),
        fechaEmision: borrador.fechaEmision,
      }, borrador.pdfFile);
      showToast(`Documento de ${retiro.nombreTienda} registrado.`);
      onSaved();
    } catch (err) {
      window.alert(mensajeDeError(err, 'No se pudo registrar la boleta o factura.'));
    } finally {
      setGuardando(false);
    }
  };

  const subtitulo = <>Retiro <strong>{retiro.codigoRetiro || '—'}</strong> · {retiro.nombreTienda}</>;
  const cargando = !factura && !facturaError;
  const sinFactura = facturaError
    ? <div className="notice boleta-error"><UiIcon name="alert" />{facturaError}</div>
    : <div className="boleta-loading"><span className="desglose-spinner" />Calculando el monto de la boleta…</div>;

  if (!editando) {
    const ivaDesactualizado = factura && Math.round(factura.iva) !== Math.round(retiro.documentoLiquidacionIva ?? 0);
    return (
      <PpModal
        title="Boleta de tarifa de servicio"
        subtitle={subtitulo}
        badge={<span className="status-pill tone-green"><UiIcon name="check" />Registrada</span>}
        onClose={onClose}
        width={1040}
        className="boleta-modal"
      >
        <div className="boleta-layout">
          {factura
            ? <DocumentoAEmitir retiro={retiro} factura={factura} tipo={retiro.documentoLiquidacionTipo || 'Boleta'} receptor={retiro.documentoLiquidacionRazonSocial || ''} rut={retiro.documentoLiquidacionRut || ''} emitido={{ folio: retiro.documentoLiquidacionFolio || '', fecha: retiro.documentoLiquidacionFechaEmision || '' }} />
            : sinFactura}
          <div className="boleta-main">
            {ivaDesactualizado && (
              <div className="notice boleta-warning">
                <UiIcon name="alert" />
                <span>
                  El IVA registrado ({formatMoney(retiro.documentoLiquidacionIva ?? 0)}) no coincide con el recalculado hoy ({formatMoney(factura!.iva)}): se registró con el cálculo anterior o antes de un reembolso. Entra a <strong>Editar</strong> y guarda para actualizarlo.
                </span>
              </div>
            )}
            <DocPaso n={0} titulo="Datos registrados" descripcion="Lo que quedó guardado para conciliar el pago.">
              <dl className="boleta-registered">
                <div><dt>Tipo</dt><dd>{retiro.documentoLiquidacionTipo}</dd></div>
                <div><dt>Folio</dt><dd>{retiro.documentoLiquidacionFolio}</dd></div>
                <div><dt>Fecha de emisión</dt><dd>{retiro.documentoLiquidacionFechaEmision ? formatDate(retiro.documentoLiquidacionFechaEmision) : '—'}</dd></div>
                <div><dt>IVA registrado</dt><dd>{formatMoney(retiro.documentoLiquidacionIva ?? 0)}</dd></div>
                <div className="is-wide"><dt>Receptor</dt><dd>{retiro.documentoLiquidacionRazonSocial} · {retiro.documentoLiquidacionRut}</dd></div>
                <div className="is-wide"><dt>Correo de envío</dt><dd>{retiro.documentoLiquidacionEmail}</dd></div>
                <div className="is-wide"><dt>Detalle</dt><dd>{retiro.documentoLiquidacionDetalle}</dd></div>
                <div className="is-wide"><dt>Archivo</dt><dd><UiIcon name="document" /> {retiro.documentoLiquidacionNombre}{retiro.documentoLiquidacionRegistradoAt ? <small> · registrado {formatDateTimeLocal(retiro.documentoLiquidacionRegistradoAt)}</small> : null}</dd></div>
              </dl>
            </DocPaso>
            {pdfUrl && (
              <div className="receipt-viewer boleta-pdf">
                <iframe title={`Documento ${retiro.documentoLiquidacionNombre ?? ''}`} src={pdfUrl} />
              </div>
            )}
            <div className="boleta-actions">
              <button className="secondary-button" type="button" onClick={() => setEditando(true)}><UiIcon name="edit" /> Editar</button>
              <button className="primary-button" type="button" onClick={onClose}>Cerrar</button>
            </div>
          </div>
        </div>
      </PpModal>
    );
  }

  const set = (campo: keyof Borrador) => (event: { target: { value: string } }) => setBorrador({ ...borrador, [campo]: event.target.value });
  const mesDistinto = retiro.fecha && borrador.fechaEmision && chileDay(retiro.fecha).slice(0, 7) !== borrador.fechaEmision.slice(0, 7);

  return (
    <PpModal
      title={completo ? 'Editar boleta de tarifa de servicio' : 'Emitir boleta de tarifa de servicio'}
      subtitle={subtitulo}
      badge={<span className={`status-pill ${completo ? 'tone-blue' : 'tone-amber'}`}>{completo ? 'Editando' : 'Pendiente'}</span>}
      onClose={onClose}
      width={1040}
      closeDisabled={guardando}
      className="boleta-modal"
    >
      <form className="boleta-layout" onSubmit={guardar}>
        {factura
          ? <DocumentoAEmitir retiro={retiro} factura={factura} tipo={borrador.type} receptor={borrador.razonSocial} rut={borrador.rut} />
          : sinFactura}

        <div className="boleta-main">
          <DocPaso
            n={1}
            titulo="Emite el documento en el SII"
            descripcion={<>En el portal del SII emite una <strong>{borrador.type.toLowerCase()} electrónica</strong> con los conceptos y montos del documento de la izquierda{factura ? <> (total <strong>{formatMoney(factura.total)}</strong>)</> : null}.</>}
          >
            <DocTipoSelector
              valor={borrador.type}
              onChange={(tipo) => setBorrador({ ...borrador, type: tipo })}
              opciones={[
                { valor: 'Factura', titulo: 'Factura electrónica', detalle: 'La tienda tiene RUT de empresa o giro' },
                { valor: 'Boleta', titulo: 'Boleta electrónica', detalle: 'Persona natural sin giro' },
              ]}
            />
          </DocPaso>

          <DocPaso n={2} titulo="Datos del receptor" descripcion="La tienda a la que RepuesTop le cobra la tarifa. Se precargan desde su perfil.">
            <div className="boleta-fields">
              <label className="form-field"><span>RUT</span><input className="input" type="text" value={borrador.rut} onChange={set('rut')} required /></label>
              <label className="form-field"><span>Razón social / Nombre</span><input className="input" type="text" value={borrador.razonSocial} onChange={set('razonSocial')} required /></label>
              <label className="form-field"><span>Correo de envío</span><input className="input" type="email" value={borrador.email} onChange={set('email')} required /></label>
              <label className="form-field"><span>Detalle o glosa</span><input className="input" type="text" value={borrador.detalle} onChange={set('detalle')} required /></label>
            </div>
          </DocPaso>

          <DocPaso n={3} titulo="Registra el documento emitido" descripcion="Sin folio, fecha y PDF el retiro no se puede pagar.">
            <div className="boleta-fields">
              <label className="form-field">
                <span>Folio asignado por el SII</span>
                <input className="input" type="text" inputMode="numeric" pattern="[0-9]+" title="Solo dígitos: el número del documento emitido" value={borrador.folio} onChange={set('folio')} placeholder="Ej: 1024" required />
              </label>
              <label className="form-field">
                <span>Fecha de emisión</span>
                <input className="input" type="date" max={todayChile()} value={borrador.fechaEmision} onChange={set('fechaEmision')} required />
                {mesDistinto && <small className="boleta-hint is-warn">Mes distinto al del retiro ({formatDate(retiro.fecha)}). Confírmalo con el contador.</small>}
              </label>
              <DocArchivo nombre={borrador.pdfName} onFile={(file) => setBorrador({ ...borrador, pdfName: file.name, pdfFile: file })} required={!borrador.pdfName} />
            </div>
          </DocPaso>

          <div className="boleta-actions">
            <button className="secondary-button" type="button" onClick={completo ? () => setEditando(false) : onClose} disabled={guardando}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={guardando || cargando}>
              <UiIcon name="check" />{guardando ? 'Guardando…' : completo ? 'Guardar cambios' : 'Registrar documento'}
            </button>
          </div>
        </div>
      </form>
    </PpModal>
  );
}
