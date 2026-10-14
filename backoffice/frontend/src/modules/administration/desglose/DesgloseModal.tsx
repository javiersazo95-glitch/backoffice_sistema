import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import UiIcon from '@/components/shared/UiIcon';
import { CopyButton } from '../pagos/CopyField';
import { formatMoney } from '../utils';
import type { Desglose, DesgloseFoco, DesgloseLinea, DesgloseSeccion } from './desglose';
import { useRetiroDesglose, type RetiroRef } from './useRetiroDesglose';

/**
 * 13-oct: desglose de la información de pago, al centro de la pantalla. Reemplaza los tooltips de
 * hover (no funcionaban en touch y las tablas los recortaban). Se abre con la "i" de cada monto
 * (`MontoInfo`) y resalta el paso del monto que se clickeó.
 */

export type DesgloseFuente = (() => Desglose) | { retiro: RetiroRef };

interface DesgloseAbierto {
  fuente: DesgloseFuente;
  foco: DesgloseFoco;
  completo: boolean;
}

/**
 * 14-oct: la "i" de una columna abre el desglose CORTO de ese dato (solo sus partidas); el
 * completo queda a un clic. `completo: true` lo abre entero (botones "Ver desglose completo").
 */
type AbrirDesglose = (fuente: DesgloseFuente, foco: DesgloseFoco, opciones?: { completo?: boolean }) => void;

const DesgloseContext = createContext<AbrirDesglose | null>(null);

export function DesgloseProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState<DesgloseAbierto | null>(null);
  const abrir = useCallback<AbrirDesglose>((fuente, foco, opciones) => setAbierto({ fuente, foco, completo: Boolean(opciones?.completo) }), []);
  const cerrar = useCallback(() => setAbierto(null), []);
  // Un DocumentoLiquidacionModal dentro de un provider ya montado no debe crear un segundo modal.
  const padre = useContext(DesgloseContext);
  if (padre) return <>{children}</>;
  return (
    <DesgloseContext.Provider value={abrir}>
      {children}
      {abierto && (typeof abierto.fuente === 'function'
        ? <DesgloseModal desglose={abierto.fuente()} foco={abierto.foco} completo={abierto.completo} onClose={cerrar} />
        : <RetiroDesgloseModal retiro={abierto.fuente.retiro} foco={abierto.foco} completo={abierto.completo} onClose={cerrar} />)}
    </DesgloseContext.Provider>
  );
}

export function useDesglose() {
  const abrir = useContext(DesgloseContext);
  if (!abrir) throw new Error('useDesglose fuera de DesgloseProvider');
  return abrir;
}

function RetiroDesgloseModal({ retiro, foco, completo, onClose }: { retiro: RetiroRef; foco: DesgloseFoco; completo: boolean; onClose: () => void }) {
  const { desglose, cargando, error } = useRetiroDesglose(retiro);
  if (desglose) return <DesgloseModal desglose={desglose} foco={foco} completo={completo} onClose={onClose} />;
  return (
    <DesgloseShell titulo={`Desglose del retiro ${retiro.codigoRetiro ?? ''}`.trim()} subtitulo={retiro.nombreTienda} onClose={onClose} compacto={!completo}>
      <div className="desglose-loading">
        {cargando ? <><span className="desglose-spinner" />Calculando el desglose…</> : <><UiIcon name="alert" />{error ?? 'No se pudo calcular el desglose.'}</>}
      </div>
    </DesgloseShell>
  );
}

function DesgloseShell({ titulo, subtitulo, onClose, children, compacto = false }: { titulo: string; subtitulo: string; onClose: () => void; children: ReactNode; compacto?: boolean }) {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Solo cierra el desglose, no el modal de abajo.
      event.stopImmediatePropagation();
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className="desglose-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onClick={(event) => event.stopPropagation()}
    >
      <section className={`desglose-modal${compacto ? ' is-compact' : ''}`} role="dialog" aria-modal="true" aria-labelledby="desglose-titulo" tabIndex={-1} ref={panelRef}>
        <header className="desglose-head">
          <div>
            <span className="desglose-eyebrow">Información de pago</span>
            <h2 id="desglose-titulo">{titulo}</h2>
            <p>{subtitulo}</p>
          </div>
          <button type="button" className="desglose-close" onClick={onClose} aria-label="Cerrar desglose"><UiIcon name="close" /></button>
        </header>
        <div className="desglose-scroll">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

const Monto = ({ linea }: { linea: DesgloseLinea }) => (
  <span className={`desglose-amount${linea.resta ? ' is-minus' : ''}${linea.informativa ? ' is-info' : ''}`}>
    {linea.resta ? '− ' : ''}{formatMoney(linea.monto)}
  </span>
);

function Paso({ n, seccion, foco, tono, area, children }: { n: number; seccion: DesgloseSeccion; foco: boolean; tono: string; area: string; children?: ReactNode }) {
  return (
    <li className={`desglose-step tone-${tono} area-${area}${foco ? ' is-focus' : ''}`} data-foco={foco || undefined}>
      <span className="desglose-step-num">{n}</span>
      <div className="desglose-step-body">
        <h3>{seccion.titulo}</h3>
        <div className="desglose-rows">
          {seccion.lineas.map((linea, index) => (
            <div className="desglose-row" key={`${linea.concepto}-${index}`}>
              <span className="desglose-concept">{linea.concepto}{linea.nota && <small>{linea.nota}</small>}</span>
              <Monto linea={linea} />
            </div>
          ))}
          <div className="desglose-row desglose-row--total">
            <span className="desglose-concept">{seccion.etiquetaTotal}</span>
            <span className="desglose-amount">{formatMoney(seccion.total)}</span>
          </div>
        </div>
        {seccion.nota && <p className="desglose-note">{seccion.nota}</p>}
        {children}
      </div>
    </li>
  );
}

export function DesgloseModal({ desglose, foco, onClose, completo = false }: { desglose: Desglose; foco: DesgloseFoco; onClose: () => void; completo?: boolean }) {
  const [verCompleto, setVerCompleto] = useState(completo);
  return (
    <DesgloseShell titulo={desglose.titulo} subtitulo={desglose.subtitulo} onClose={onClose} compacto={!verCompleto}>
      {verCompleto
        ? <DesgloseView desglose={desglose} foco={foco} />
        : <DesgloseDatoView desglose={desglose} foco={foco} onCompleto={() => setVerCompleto(true)} />}
    </DesgloseShell>
  );
}

const DATO: Record<DesgloseFoco, { titulo: string; tono: string; explica: string }> = {
  venta: { titulo: 'Venta total', tono: 'slate', explica: 'Lo que pagó el comprador a esta tienda, con despacho. Sobre este monto se calculan los cobros.' },
  descuentos: { titulo: 'Descuentos al vendedor', tono: 'red', explica: 'Lo que RepuesTop le cobra a la tienda: comisión de servicio y cargo de pago, cada uno con IVA.' },
  recibe: { titulo: 'Vendedor recibe', tono: 'green', explica: 'La venta menos lo que se le descuenta. Es lo que se le transfiere.' },
  boleta: { titulo: 'Boleta a emitir', tono: 'blue', explica: 'Se factura exactamente lo que se le descontó a la tienda: comisión y cargo de pago, con IVA 19%.' },
  ganancia: { titulo: 'Ganancia neta RepuesTop', tono: 'violet', explica: 'Lo que le queda a RepuesTop: el IVA se paga al SII y el cargo de pago se le paga a Flow.' },
};

const DATO_RECARGA: Partial<Record<DesgloseFoco, { titulo: string; explica: string }>> = {
  venta: { titulo: 'Monto pagado', explica: 'Lo que pagó el comprador por las Monedas, con IVA incluido.' },
  boleta: { titulo: 'Documento al comprador', explica: 'RepuesTop vende directo: emite el documento por el total pagado.' },
  ganancia: { titulo: 'Ganancia RepuesTop', explica: 'La venta sin IVA, menos la comisión de Flow sin IVA, que asume RepuesTop.' },
};

/**
 * 14-oct: el desglose corto de UN dato (la columna donde se hizo clic): el monto, una frase de qué
 * es y solo las partidas que lo forman. El desglose completo queda a un clic.
 */
function DesgloseDatoView({ desglose, foco, onCompleto }: { desglose: Desglose; foco: DesgloseFoco; onCompleto: () => void }) {
  const base = DATO[foco];
  const recarga = desglose.tipo === 'recarga' ? DATO_RECARGA[foco] : undefined;
  const titulo = recarga?.titulo ?? base.titulo;
  const explica = recarga?.explica ?? base.explica;

  let lineas: DesgloseLinea[] = [];
  let total = 0;
  let etiquetaTotal = titulo;
  if (foco === 'boleta' && desglose.boleta) {
    lineas = [
      ...desglose.boleta.lineas.map((linea) => ({ concepto: linea.concepto, monto: linea.total, nota: `Neto ${formatMoney(linea.neto)} + IVA ${formatMoney(linea.iva)}` })),
    ];
    total = desglose.boleta.total;
    etiquetaTotal = `Total (neto ${formatMoney(desglose.boleta.neto)} + IVA ${formatMoney(desglose.boleta.iva)})`;
  } else {
    const seccion = foco === 'venta' ? desglose.venta
      : foco === 'descuentos' ? desglose.descuentos
        : foco === 'recibe' ? desglose.recibe
          : desglose.ganancia;
    if (seccion) {
      lineas = seccion.lineas;
      total = seccion.total;
      etiquetaTotal = seccion.etiquetaTotal;
    }
  }
  const avisos = foco === 'recibe' || foco === 'venta' ? desglose.avisos : [];

  return (
    <div className="desglose-dato">
      <div className={`desglose-dato-hero tone-${base.tono}`}>
        <span>{titulo}</span>
        <strong>{formatMoney(total)}</strong>
        <p>{explica}</p>
      </div>
      <div className="desglose-rows">
        {lineas.map((linea, index) => (
          <div className="desglose-row" key={`${linea.concepto}-${index}`}>
            <span className="desglose-concept">{linea.concepto}{linea.nota && <small>{linea.nota}</small>}</span>
            <Monto linea={linea} />
          </div>
        ))}
        <div className="desglose-row desglose-row--total">
          <span className="desglose-concept">{etiquetaTotal}</span>
          <span className="desglose-amount">{formatMoney(total)}</span>
        </div>
      </div>
      {avisos.map((aviso) => <div className="desglose-aviso" key={aviso}><UiIcon name="info" /><span>{aviso}</span></div>)}
      <button type="button" className="desglose-link desglose-dato-more" onClick={onCompleto}>Ver desglose completo <UiIcon name="arrowRight" /></button>
    </div>
  );
}

/** Cuerpo del desglose; también se usa sin el modal (Detalle de liquidación). */
export function DesgloseView({ desglose, foco }: { desglose: Desglose; foco?: DesgloseFoco }) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // Baja al paso del monto que se clickeó (las tarjetas de arriba quedan como resumen).
    const destino = listRef.current?.querySelector<HTMLElement>('[data-foco="true"]');
    if (destino) destino.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [foco, desglose]);

  const textoBoleta = useMemo(() => desglose.boleta ? [
    ...desglose.boleta.lineas.map((linea) => `${linea.concepto}: neto ${formatMoney(linea.neto)}`),
    `Neto: ${formatMoney(desglose.boleta.neto)}`,
    `IVA 19%: ${formatMoney(desglose.boleta.iva)}`,
    `Total: ${formatMoney(desglose.boleta.total)}`,
  ].join('\n') : '', [desglose.boleta]);

  let paso = 0;
  return (
    <div className="desglose-view">
      <div className="desglose-heroes">
        {desglose.heroes.map((hero) => (
          <article key={hero.foco} className={`desglose-hero tone-${hero.tono}${hero.foco === foco ? ' is-focus' : ''}`}>
            <span>{hero.etiqueta}</span>
            <strong>{formatMoney(hero.monto)}</strong>
            <small>{hero.detalle}</small>
          </article>
        ))}
      </div>

      {desglose.cuadre && (
        <div className={`desglose-cuadre${desglose.cuadre.ok ? ' is-ok' : ' is-bad'}`}>
          <UiIcon name={desglose.cuadre.ok ? 'check' : 'alert'} />
          <span>{desglose.cuadre.texto}</span>
        </div>
      )}
      {desglose.avisos.map((aviso) => (
        <div className="desglose-aviso" key={aviso}><UiIcon name="info" /><span>{aviso}</span></div>
      ))}

      {/* Tres columnas en escritorio: todo el desglose se ve de una vez, sin scroll. */}
      <ol className={`desglose-steps${desglose.tipo === 'recarga' ? ' is-recarga' : ''}`} ref={listRef}>
        <Paso n={++paso} seccion={desglose.venta} foco={foco === 'venta'} tono="slate" area="venta" />
        {desglose.descuentos && <Paso n={++paso} seccion={desglose.descuentos} foco={foco === 'descuentos'} tono="red" area="descuentos" />}
        {desglose.recibe && <Paso n={++paso} seccion={desglose.recibe} foco={foco === 'recibe'} tono="green" area="recibe" />}
        {desglose.boleta && (
          <li className={`desglose-step tone-blue area-boleta${foco === 'boleta' ? ' is-focus' : ''}`} data-foco={foco === 'boleta' || undefined}>
            <span className="desglose-step-num">{++paso}</span>
            <div className="desglose-step-body">
              <div className="desglose-step-title">
                <h3>{desglose.boleta.titulo}</h3>
                <CopyButton text={textoBoleta} label="Copiar datos" className="pp-copy-button--solid" />
              </div>
              <div className="desglose-rows">
                {desglose.boleta.lineas.map((linea) => (
                  <div className="desglose-row" key={linea.concepto}>
                    <span className="desglose-concept">{linea.concepto}<small>Neto {formatMoney(linea.neto)} + IVA {formatMoney(linea.iva)}</small></span>
                    <span className="desglose-amount">{formatMoney(linea.total)}</span>
                  </div>
                ))}
                <div className="desglose-row desglose-row--sub"><span className="desglose-concept">Neto</span><span className="desglose-amount">{formatMoney(desglose.boleta.neto)}</span></div>
                <div className="desglose-row desglose-row--sub"><span className="desglose-concept">IVA 19%</span><span className="desglose-amount">{formatMoney(desglose.boleta.iva)}</span></div>
                <div className="desglose-row desglose-row--total desglose-row--boleta">
                  <span className="desglose-concept">Monto de la boleta</span>
                  <span className="desglose-amount">{formatMoney(desglose.boleta.total)}</span>
                </div>
              </div>
              <p className="desglose-why"><strong>¿Por qué este monto?</strong> {desglose.boleta.porQue}</p>
              {desglose.boleta.aviso && <p className="desglose-note is-warn">{desglose.boleta.aviso}</p>}
            </div>
          </li>
        )}
        <Paso n={++paso} seccion={desglose.ganancia} foco={foco === 'ganancia'} tono="violet" area="ganancia" />
      </ol>

      {desglose.ventas && desglose.ventas.length > 0 && (
        <details className="desglose-ventas">
          <summary>Ver las {desglose.ventas.length} venta{desglose.ventas.length === 1 ? '' : 's'} una por una</summary>
          <div className="desglose-ventas-wrap">
            <table>
              <thead><tr><th>Liquidación</th><th>Base de venta</th><th>Descuentos</th><th>Recibe</th><th>Boleta</th><th>Gana RepuesTop</th></tr></thead>
              <tbody>
                {desglose.ventas.map((venta) => (
                  <tr key={venta.id}><td>{venta.id}</td><td>{formatMoney(venta.base)}</td><td>−{formatMoney(venta.descuentos)}</td><td>{formatMoney(venta.recibe)}</td><td>{formatMoney(venta.boleta)}</td><td>{formatMoney(venta.ganancia)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

/** Las tres cifras clave y el cuadre, con acceso al desglose completo (Vista previa, carga de boleta). */
export function DesgloseResumen({ desglose, foco = 'recibe' }: { desglose: Desglose; foco?: DesgloseFoco }) {
  const abrir = useDesglose();
  return (
    <div className="desglose-resumen">
      <div className="desglose-heroes">
        {desglose.heroes.map((hero) => (
          <button type="button" key={hero.foco} className={`desglose-hero tone-${hero.tono}`} onClick={() => abrir(() => desglose, hero.foco, { completo: true })} title="Ver el desglose">
            <span>{hero.etiqueta}<UiIcon name="info" /></span>
            <strong>{formatMoney(hero.monto)}</strong>
            <small>{hero.detalle}</small>
          </button>
        ))}
      </div>
      {desglose.cuadre && (
        <div className={`desglose-cuadre${desglose.cuadre.ok ? ' is-ok' : ' is-bad'}`}>
          <UiIcon name={desglose.cuadre.ok ? 'check' : 'alert'} />
          <span>{desglose.cuadre.texto}</span>
          <button type="button" className="desglose-link" onClick={() => abrir(() => desglose, foco, { completo: true })}>Ver desglose completo</button>
        </div>
      )}
      {desglose.avisos.map((aviso) => (
        <div className="desglose-aviso" key={aviso}><UiIcon name="info" /><span>{aviso}</span></div>
      ))}
    </div>
  );
}

/** Monto con su "i": un botón que abre el desglose al centro de la pantalla. */
export function MontoInfo({
  value,
  fuente,
  foco,
  strong = false,
  children,
  label,
}: {
  value: number;
  fuente: DesgloseFuente;
  foco: DesgloseFoco;
  strong?: boolean;
  children?: ReactNode;
  label?: string;
}) {
  const abrir = useDesglose();
  const texto = formatMoney(value);
  return (
    <button
      type="button"
      className={`monto-info${strong ? ' is-strong' : ''}`}
      onClick={(event) => { event.stopPropagation(); abrir(fuente, foco); }}
      title="Ver el desglose"
      aria-label={`${label ?? 'Monto'} ${texto}: ver desglose`}
    >
      <span className="monto-info-value">{children ?? (strong ? <strong>{texto}</strong> : texto)}</span>
      <UiIcon name="info" />
    </button>
  );
}
