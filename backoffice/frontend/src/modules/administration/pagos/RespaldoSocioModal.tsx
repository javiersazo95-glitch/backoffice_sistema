import UiIcon from '@/components/shared/UiIcon';
import { formatDate, formatMoney } from '../utils';
import PpModal from './PpModal';
import { DocArchivo, DocPaper, DocPaso, DocPorQue, DocTipoSelector } from './documentoUi';

export interface RespaldoSocioDatos {
  tipo: string;
  rut: string;
  nombre: string;
  email: string;
  detalle: string;
  iva: string;
  pdfName: string;
}

/**
 * Tipos que se ofrecen para un retiro nuevo. "Boleta de Honorarios" ya no: un retiro de utilidades
 * no es un servicio prestado (deducirlo como gasto lo rechaza el SII, art. 21 LIR).
 */
const TIPOS = [
  { valor: 'Comprobante de retiro', titulo: 'Comprobante de retiro', detalle: 'Reparto de utilidades (lo habitual)' },
  { valor: 'Liquidación de sueldo', titulo: 'Liquidación de sueldo', detalle: 'Si el retiro fue remuneración por trabajo' },
  { valor: 'Documento Tributario', titulo: 'Documento tributario', detalle: 'Otro documento del SII' },
];

/**
 * 14-oct: respaldo del retiro de un socio, con el mismo formato que la boleta de tarifa de servicio.
 * Antes había dos formularios distintos (Liquidaciones › Socios y Pago a proveedores); ahora los dos
 * usan este y cada página conserva su forma de guardar. No es un DTE: no lleva folio ni fecha SII.
 */
export default function RespaldoSocioModal({
  socio,
  codigo,
  monto,
  fecha,
  datos,
  onChange,
  onFile,
  onQuitarPdf,
  onSubmit,
  onClose,
  guardando = false,
  editando,
}: {
  socio: string;
  codigo: string;
  monto: number | null;
  fecha?: string;
  datos: RespaldoSocioDatos;
  onChange: (cambios: Partial<RespaldoSocioDatos>) => void;
  onFile: (file: File) => void;
  /** Solo al editar: deja el registro sin PDF. */
  onQuitarPdf?: () => void;
  onSubmit: () => void;
  onClose: () => void;
  guardando?: boolean;
  editando: boolean;
}) {
  // Un tipo histórico (p. ej. "Boleta de Honorarios") se conserva como opción para no perderlo.
  const opciones = TIPOS.some((tipo) => tipo.valor === datos.tipo) || !datos.tipo
    ? TIPOS
    : [...TIPOS, { valor: datos.tipo, titulo: datos.tipo, detalle: 'Tipo registrado anteriormente' }];
  const iva = Number(datos.iva) || 0;

  return (
    <PpModal
      title={editando ? 'Editar respaldo del retiro de socio' : 'Cargar respaldo del retiro de socio'}
      subtitle={<>Retiro <strong>{codigo}</strong> · {socio}</>}
      badge={<span className={`status-pill ${datos.pdfName ? 'tone-green' : 'tone-amber'}`}>{datos.pdfName ? 'Con PDF' : 'Sin respaldo'}</span>}
      onClose={onClose}
      width={1040}
      closeDisabled={guardando}
      className="boleta-modal"
    >
      <form className="boleta-layout" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <aside className="boleta-doc">
          <DocPaper
            kicker="Respaldo interno · no es un DTE"
            titulo={datos.tipo || 'Comprobante de retiro'}
            estado={datos.pdfName ? { texto: 'PDF adjunto', tono: 'done' } : { texto: 'Sin respaldo', tono: 'pending' }}
            emisor="RepuesTop"
            receptor={datos.nombre || socio}
            receptorDetalle={datos.rut}
            extra={fecha ? [{ label: 'Fecha del retiro', value: formatDate(fecha) }] : []}
            lineasEtiqueta="Monto"
            lineas={monto !== null ? [{ concepto: datos.detalle || `Retiro de libre disposición socio - ${socio}`, monto }] : []}
            totales={[{ label: 'IVA registrado', value: formatMoney(iva) }]}
            total={monto !== null ? { label: 'Monto del retiro', monto } : null}
          />
          <DocPorQue
            titulo="¿Qué se respalda y por qué?"
            texto={<>Un retiro de socio es <strong>reparto de utilidades</strong>, no un pago por un servicio: no lleva boleta de honorarios ni IVA. Se adjunta un respaldo interno por el monto transferido; si el retiro fue remuneración por trabajo, el respaldo es la liquidación de sueldo.</>}
            filas={monto !== null ? [{ label: 'Monto transferido al socio', monto, tipo: 'result' }] : []}
          />
        </aside>

        <div className="boleta-main">
          <DocPaso n={1} titulo="Elige el tipo de respaldo" descripcion="Según la naturaleza del retiro que se declaró al registrarlo.">
            <DocTipoSelector valor={datos.tipo} onChange={(tipo) => onChange({ tipo })} opciones={opciones} />
          </DocPaso>

          <DocPaso n={2} titulo="Datos del socio" descripcion="Se precargan desde la ficha del socio.">
            <div className="boleta-fields">
              <label className="form-field"><span>RUT</span><input className="input" type="text" value={datos.rut} onChange={(event) => onChange({ rut: event.target.value })} placeholder="Ej: 15.123.456-7" required={!editando} /></label>
              <label className="form-field"><span>Nombre</span><input className="input" type="text" value={datos.nombre} onChange={(event) => onChange({ nombre: event.target.value })} required={!editando} /></label>
              <label className="form-field"><span>Correo</span><input className="input" type="email" value={datos.email} onChange={(event) => onChange({ email: event.target.value })} required={!editando} /></label>
              <label className="form-field"><span>Detalle</span><input className="input" type="text" value={datos.detalle} onChange={(event) => onChange({ detalle: event.target.value })} required={!editando} /></label>
              <label className="form-field">
                <span>IVA</span>
                <input className="input" type="number" min="0" step="1" value={datos.iva} onChange={(event) => onChange({ iva: event.target.value })} />
                <small className="boleta-hint">Normalmente $0: un reparto de utilidades no lleva IVA. Se registra el valor que ingreses.</small>
              </label>
            </div>
          </DocPaso>

          <DocPaso n={3} titulo="Adjunta el respaldo firmado" descripcion="El PDF del comprobante, la liquidación o el documento elegido.">
            <div className="boleta-fields">
              <DocArchivo nombre={datos.pdfName} onFile={onFile} required={!editando && !datos.pdfName} titulo="Adjunta el PDF del respaldo" ayuda="Solo .pdf" />
              {editando && datos.pdfName && onQuitarPdf && (
                <button type="button" className="document-file-remove is-wide" onClick={onQuitarPdf}><UiIcon name="trash" /> Quitar el PDF</button>
              )}
              {editando && !datos.pdfName && <div className="document-file-empty is-wide"><UiIcon name="info" />El registro quedará sin PDF adjunto.</div>}
            </div>
          </DocPaso>

          <div className="boleta-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={guardando}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={guardando}>
              <UiIcon name="check" />{guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar respaldo'}
            </button>
          </div>
        </div>
      </form>
    </PpModal>
  );
}
