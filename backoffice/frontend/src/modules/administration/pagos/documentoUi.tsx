import type { ReactNode } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import { formatMoney } from '../utils';
import { CopyButton } from './CopyField';

/**
 * 14-oct: piezas comunes de los popups que emiten o cargan un documento (boleta de tarifa de
 * servicio, documento de una recarga, nota de crédito, respaldo del retiro de un socio). Todos
 * siguen el mismo orden: a la izquierda el documento tal como queda y por qué es ese monto; a la
 * derecha los pasos numerados para emitirlo y registrarlo.
 */

export interface DocFila {
  label: ReactNode;
  value: ReactNode;
}

/** El documento "en papel": tipo, emisor, receptor, líneas y totales. */
export function DocPaper({
  kicker,
  titulo,
  estado,
  emisor,
  receptor,
  receptorDetalle,
  extra = [],
  lineasEtiqueta = 'Neto',
  lineas,
  totales,
  total,
  copiar,
  nota,
}: {
  kicker: string;
  titulo: string;
  estado: { texto: string; sub?: string; tono: 'pending' | 'done' | 'info' };
  emisor: string;
  receptor: string;
  receptorDetalle?: string;
  extra?: DocFila[];
  lineasEtiqueta?: string;
  lineas: { concepto: string; monto: number }[];
  totales: DocFila[];
  total: { label: string; monto: number } | null;
  copiar?: { texto: string; label?: string };
  nota?: ReactNode;
}) {
  return (
    <div className="boleta-doc-paper">
      <header className="boleta-doc-head">
        <div>
          <span className="boleta-doc-kicker">{kicker}</span>
          <strong>{titulo}</strong>
        </div>
        <span className={`boleta-doc-folio${estado.tono === 'pending' ? ' is-pending' : estado.tono === 'info' ? ' is-info' : ''}`}>
          {estado.texto}{estado.sub && <small>{estado.sub}</small>}
        </span>
      </header>

      <dl className="boleta-doc-parties">
        <div><dt>Emisor</dt><dd>{emisor}</dd></div>
        <div><dt>Receptor</dt><dd>{receptor || '—'}{receptorDetalle !== undefined && <small>{receptorDetalle || 'Sin RUT'}</small>}</dd></div>
        {extra.map((fila, index) => <div key={index}><dt>{fila.label}</dt><dd className="is-light">{fila.value}</dd></div>)}
      </dl>

      {lineas.length > 0 && (
        <table className="boleta-doc-lines">
          <thead><tr><th>Concepto</th><th>{lineasEtiqueta}</th></tr></thead>
          <tbody>
            {lineas.map((linea) => <tr key={linea.concepto}><td>{linea.concepto}</td><td>{formatMoney(linea.monto)}</td></tr>)}
          </tbody>
        </table>
      )}

      <dl className="boleta-doc-totals">
        {totales.map((fila, index) => <div key={index}><dt>{fila.label}</dt><dd>{fila.value}</dd></div>)}
        {total && <div className="is-total"><dt>{total.label}</dt><dd>{formatMoney(total.monto)}</dd></div>}
      </dl>

      {nota && <p className="boleta-doc-note">{nota}</p>}
      {copiar && <CopyButton text={copiar.texto} label={copiar.label ?? 'Copiar datos para el SII'} className="pp-copy-button--solid boleta-doc-copy" />}
    </div>
  );
}

export interface DocPorQueFila {
  label: string;
  monto: number;
  tipo?: 'minus' | 'result';
}

/** "¿Por qué este monto?": una frase y la cuenta que llega al total. */
export function DocPorQue({ texto, filas, accion, titulo = '¿Por qué este monto?' }: { texto: ReactNode; filas: DocPorQueFila[]; accion?: ReactNode; titulo?: string }) {
  return (
    <section className="boleta-why">
      <h4><UiIcon name="info" />{titulo}</h4>
      <p>{texto}</p>
      {filas.length > 0 && (
        <dl className="boleta-why-eq">
          {filas.map((fila) => (
            <div key={fila.label} className={fila.tipo === 'minus' ? 'is-minus' : fila.tipo === 'result' ? 'is-result' : undefined}>
              <dt>{fila.tipo === 'minus' ? '− ' : fila.tipo === 'result' ? '= ' : ''}{fila.label}</dt>
              <dd>{formatMoney(fila.monto)}</dd>
            </div>
          ))}
        </dl>
      )}
      {accion}
    </section>
  );
}

/** Un paso numerado del lado derecho. `n = 0` lo marca como completado. */
export function DocPaso({ n, titulo, descripcion, children }: { n: number; titulo: string; descripcion?: ReactNode; children: ReactNode }) {
  return (
    <section className="boleta-step">
      <header>
        <span className={`boleta-step-num${n === 0 ? ' is-done' : ''}`}>{n === 0 ? <UiIcon name="check" /> : n}</span>
        <div>
          <h4>{titulo}</h4>
          {descripcion && <p>{descripcion}</p>}
        </div>
      </header>
      <div className="boleta-step-body">{children}</div>
    </section>
  );
}

/** Selector del tipo de documento como tarjetas (en vez de un select). */
export function DocTipoSelector({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: string; titulo: string; detalle?: string }[];
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className={`boleta-type${opciones.length > 2 ? ' is-three' : ''}`}>
      {opciones.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          className={`boleta-type-option${valor === opcion.valor ? ' is-active' : ''}`}
          onClick={() => onChange(opcion.valor)}
          aria-pressed={valor === opcion.valor}
        >
          <strong>{opcion.titulo}</strong>
          {opcion.detalle && <small>{opcion.detalle}</small>}
        </button>
      ))}
    </div>
  );
}

/** Zona para adjuntar el PDF; verde cuando ya hay un archivo. */
export function DocArchivo({
  nombre,
  onFile,
  required,
  ayuda = 'Solo .pdf, el que descargaste del SII',
  titulo = 'Adjunta el PDF del documento',
  accept = '.pdf,application/pdf',
}: {
  nombre: string;
  onFile: (file: File) => void;
  required: boolean;
  ayuda?: string;
  titulo?: string;
  accept?: string;
}) {
  return (
    <label className={`boleta-file is-wide${nombre ? ' has-file' : ''}`}>
      <input
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
        required={required}
      />
      <UiIcon name={nombre ? 'fileCheck' : 'upload'} />
      <span>
        {nombre
          ? <><strong>{nombre}</strong><small>Haz clic para reemplazar el PDF</small></>
          : <><strong>{titulo}</strong><small>{ayuda}</small></>}
      </span>
    </label>
  );
}
