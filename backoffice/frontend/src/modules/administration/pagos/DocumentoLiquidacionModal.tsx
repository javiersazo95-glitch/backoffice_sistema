import { useEffect, useState, type FormEvent } from 'react';
import * as adminApi from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import { chileDay, formatDate, formatDateTimeLocal, formatMoney } from '../utils';
import type { RetiroAdminResponse } from '../types';
import PpModal from './PpModal';
import { CopyButton } from './CopyField';

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
 * Carga de la boleta o factura de comision de un retiro de PROVEEDOR desde Pago a proveedores
 * (13-oct). Pide lo mismo que Liquidaciones > En liquidacion y guarda por el mismo endpoint, asi
 * que la puerta de pago (documento completo: tipo, RUT, razon social, correo, detalle, folio, fecha
 * de emision y PDF) es identica; el backend la vuelve a exigir al marcar transferido.
 *
 * Si el documento ya esta completo muestra lo registrado con el PDF, y "Editar" abre el formulario.
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

  if (!editando) {
    return (
      <PpModal
        title="Documento registrado"
        subtitle={<>Retiro <strong>{retiro.codigoRetiro || '—'}</strong> · {retiro.nombreTienda}</>}
        badge={<span className="status-pill tone-green">Boleta lista</span>}
        onClose={onClose}
        width={720}
      >
        <div className="registered-document-preview">
          <dl className="registered-document-data">
            <dt>Tipo de documento</dt><dd>{retiro.documentoLiquidacionTipo}</dd>
            <dt>Folio</dt><dd>{retiro.documentoLiquidacionFolio}</dd>
            <dt>Fecha de emisión</dt><dd>{retiro.documentoLiquidacionFechaEmision ? formatDate(retiro.documentoLiquidacionFechaEmision) : '—'}</dd>
            <dt>RUT receptor</dt><dd>{retiro.documentoLiquidacionRut}</dd>
            <dt>Razón social / Nombre</dt><dd>{retiro.documentoLiquidacionRazonSocial}</dd>
            <dt>Correo de envío</dt><dd>{retiro.documentoLiquidacionEmail}</dd>
            <dt>Detalle</dt><dd>{retiro.documentoLiquidacionDetalle}</dd>
            <dt>IVA de la factura</dt><dd>{formatMoney(retiro.documentoLiquidacionIva ?? 0)}</dd>
            <dt>Documento</dt><dd><strong>{retiro.documentoLiquidacionNombre}</strong></dd>
            {retiro.documentoLiquidacionRegistradoAt && <><dt>Registrado</dt><dd>{formatDateTimeLocal(retiro.documentoLiquidacionRegistradoAt)}</dd></>}
          </dl>
          {pdfUrl && (
            <div className="receipt-viewer registered-document-pdf">
              <iframe title={`Documento ${retiro.documentoLiquidacionNombre ?? ''}`} src={pdfUrl} />
            </div>
          )}
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => setEditando(true)}><UiIcon name="edit" /> Editar</button>
            <button className="primary-button" type="button" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </PpModal>
    );
  }

  const textoFactura = factura ? [
    `Receptor: ${borrador.razonSocial}`,
    borrador.rut ? `RUT: ${borrador.rut}` : null,
    '',
    ...factura.lineas.map((linea) => `${linea.concepto}: neto ${formatMoney(linea.neto)}`),
    `Neto: ${formatMoney(factura.neto)}`,
    `IVA 19%: ${formatMoney(factura.iva)}`,
    `Total: ${formatMoney(factura.total)}`,
  ].filter((linea) => linea !== null).join('\n') : '';

  return (
    <PpModal
      title={completo ? 'Editar documento registrado' : 'Cargar boleta o factura de comisión'}
      subtitle={<>Retiro <strong>{retiro.codigoRetiro || '—'}</strong> · {retiro.nombreTienda}</>}
      onClose={onClose}
      width={720}
      closeDisabled={guardando}
    >
      <form className="form-grid" onSubmit={guardar}>
        <label className="form-field">
          <span>Tipo de documento</span>
          <select className="select" value={borrador.type} onChange={(event) => setBorrador({ ...borrador, type: event.target.value })}>
            {Array.from(new Set(['Factura', 'Boleta', borrador.type].filter(Boolean))).map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>RUT receptor</span>
          <input className="input" type="text" value={borrador.rut} onChange={(event) => setBorrador({ ...borrador, rut: event.target.value })} required />
        </label>

        {factura && (
          <div className="registered-document-preview">
            <div className="notice">
              <strong>Datos para emitir en el SII</strong>
              <CopyButton text={textoFactura} label="Copiar datos" className="pp-copy-button--solid" />
            </div>
            <table className="factura-sii-tabla">
              <thead><tr><th style={{ textAlign: 'left' }}>Concepto</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
              <tbody>
                {factura.lineas.map((linea) => (
                  <tr key={linea.concepto}><td>{linea.concepto} <span style={{ color: '#64748b' }}>(neto)</span></td><td style={{ textAlign: 'right' }}>{formatMoney(linea.neto)}</td></tr>
                ))}
                <tr><td><strong>Neto</strong></td><td style={{ textAlign: 'right' }}><strong>{formatMoney(factura.neto)}</strong></td></tr>
                <tr><td><strong>IVA 19%</strong></td><td style={{ textAlign: 'right' }}><strong>{formatMoney(factura.iva)}</strong></td></tr>
                <tr><td><strong>Total</strong></td><td style={{ textAlign: 'right' }}><strong>{formatMoney(factura.total)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        )}
        {facturaError && <div className="notice"><UiIcon name="info" />{facturaError}</div>}

        <label className="form-field">
          <span>Folio (número que asignó el SII al emitir)</span>
          <input className="input" type="text" inputMode="numeric" pattern="[0-9]+" title="Solo dígitos: el número del documento emitido" value={borrador.folio} onChange={(event) => setBorrador({ ...borrador, folio: event.target.value })} placeholder="Ej: 1024" required />
        </label>
        <label className="form-field">
          <span>Fecha de emisión</span>
          <input className="input" type="date" max={todayChile()} value={borrador.fechaEmision} onChange={(event) => setBorrador({ ...borrador, fechaEmision: event.target.value })} required />
          {retiro.fecha && borrador.fechaEmision && chileDay(retiro.fecha).slice(0, 7) !== borrador.fechaEmision.slice(0, 7) && (
            <small style={{ color: '#b45309', fontSize: 12 }}>
              Se emite en un mes distinto al del retiro ({formatDate(retiro.fecha)}). Confírmalo con el contador.
            </small>
          )}
        </label>
        <label className="form-field">
          <span>Razón social / Nombre</span>
          <input className="input" type="text" value={borrador.razonSocial} onChange={(event) => setBorrador({ ...borrador, razonSocial: event.target.value })} required />
        </label>
        <label className="form-field">
          <span>Correo de envío</span>
          <input className="input" type="email" value={borrador.email} onChange={(event) => setBorrador({ ...borrador, email: event.target.value })} required />
        </label>
        <label className="form-field">
          <span>Detalle</span>
          <input className="input" type="text" value={borrador.detalle} onChange={(event) => setBorrador({ ...borrador, detalle: event.target.value })} required />
        </label>
        <label className="form-field">
          <span>IVA de la factura (calculado)</span>
          <input className="input" type="number" min="0" step="1" value={borrador.iva} readOnly title="Lo calcula el sistema: comisión de servicio más cargo por procesamiento de pago." />
          <small style={{ color: '#64748b', fontSize: 12 }}>Calculado por el sistema: comisión de servicio más cargo por procesamiento de pago.</small>
        </label>
        <label className="form-field">
          <span>Cargar Boleta / Factura (PDF)</span>
          <input
            className="input"
            type="file"
            accept=".pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setBorrador({ ...borrador, pdfName: file.name, pdfFile: file });
            }}
            required={!borrador.pdfName}
          />
          {borrador.pdfName && (
            <div className="document-file-status">
              <span><UiIcon name="check" />Archivo cargado: <strong>{borrador.pdfName}</strong></span>
            </div>
          )}
        </label>
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={completo ? () => setEditando(false) : onClose} disabled={guardando}>Cancelar</button>
          <button className="primary-button" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : completo ? 'Guardar cambios' : 'Registrar documento'}</button>
        </div>
      </form>
    </PpModal>
  );
}
