import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getCapturedBuyers } from '@/api/capturerSocial';
import UiIcon from '@/components/shared/UiIcon';
import { formatCurrency } from '@/utils/formatters';
import type { CapturedBuyersOrden, CapturedBuyersQuery } from '@/types/capturerSocial';
import { pct } from './capturerMetricsUi';

const TAMANOS = [25, 50, 100];
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const miles = (n: number) => n.toLocaleString('es-CL');

/** Números de página a mostrar: primera, última y la actual ±1, con "…" entre saltos. */
function paginas(actual: number, total: number): Array<number | '…'> {
  const set = new Set([0, total - 1, actual - 1, actual, actual + 1].filter(p => p >= 0 && p < total));
  const orden = [...set].sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  orden.forEach((p, i) => { if (i > 0 && p - orden[i - 1]! > 1) out.push('…'); out.push(p); });
  return out;
}

/**
 * Compradores referidos de un captador, paginados en el servidor (un captador puede llegar a
 * miles). Búsqueda por nombre/correo, filtros por compra y canal, orden y tamaño de página.
 */
export default function CapturedBuyersTable({ captadorId, resumen = false }: { captadorId: number; resumen?: boolean }) {
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [compra, setCompra] = useState<CapturedBuyersQuery['compra']>('');
  const [canal, setCanal] = useState<CapturedBuyersQuery['canal']>('');
  const [orden, setOrden] = useState<CapturedBuyersOrden>('RECIENTES');
  const [pagina, setPagina] = useState(0);
  const [tamano, setTamano] = useState(25);

  // La búsqueda espera a que se deje de escribir para no consultar por cada tecla.
  useEffect(() => {
    const t = window.setTimeout(() => { setQ(texto.trim()); setPagina(0); }, 350);
    return () => window.clearTimeout(t);
  }, [texto]);

  const params: CapturedBuyersQuery = { q, compra, canal, orden, pagina, tamano };
  const res = useQuery({
    queryKey: ['trust-capturer-buyers', captadorId, params],
    queryFn: () => getCapturedBuyers(captadorId, params),
    placeholderData: keepPreviousData,
  });
  const d = res.data;
  const filas = d?.contenido ?? [];
  const totalPaginas = d?.totalPaginas ?? 0;
  const desde = d && d.total ? d.pagina * d.tamano + 1 : 0;
  const hasta = d ? d.pagina * d.tamano + filas.length : 0;
  const filtrado = Boolean(q || compra || canal);
  const cambiar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(0); };

  // Si los filtros dejan menos páginas que la actual, vuelve a la última disponible.
  useEffect(() => { if (d && d.totalPaginas > 0 && pagina >= d.totalPaginas) setPagina(d.totalPaginas - 1); }, [d, pagina]);

  return <div className="cbt">
    <style>{cbtCss}</style>
    {resumen && <div className="cbt-sum">
      <div><small>Referidos</small><strong>{d ? miles(d.referidos) : '…'}</strong></div>
      <div><small>Con compra</small><strong>{d ? miles(d.conCompra) : '…'}</strong></div>
      <div><small>Conversión</small><strong>{d ? pct(d.conCompra, d.referidos) : '…'}</strong></div>
      <div><small>Monto base</small><strong>{d ? formatCurrency(d.montoBase) : '…'}</strong></div>
      <div><small>Ingreso generado</small><strong className="cbt-green">{d ? formatCurrency(d.ingreso) : '…'}</strong></div>
    </div>}

    <div className="cbt-bar">
      <label className="cbt-search">
        <UiIcon name="search" />
        <input value={texto} maxLength={80} onChange={e => setTexto(e.target.value)} placeholder="Buscar por nombre o correo" aria-label="Buscar comprador" />
        {texto && <button type="button" onClick={() => setTexto('')} aria-label="Limpiar búsqueda"><UiIcon name="close" /></button>}
      </label>
      <select value={compra} onChange={e => cambiar(setCompra)(e.target.value as CapturedBuyersQuery['compra'])} aria-label="Filtrar por compra">
        <option value="">Todos</option><option value="CON_COMPRA">Con compra</option><option value="SIN_COMPRA">Aún sin compra</option>
      </select>
      <select value={canal} onChange={e => cambiar(setCanal)(e.target.value as CapturedBuyersQuery['canal'])} aria-label="Filtrar por canal">
        <option value="">Web y app</option><option value="WEB">Web</option><option value="MOBILE">App</option>
      </select>
      <select value={orden} onChange={e => cambiar(setOrden)(e.target.value as CapturedBuyersOrden)} aria-label="Ordenar">
        <option value="RECIENTES">Más recientes</option><option value="ANTIGUOS">Más antiguos</option>
        <option value="PRIMERA_COMPRA">Primera compra reciente</option><option value="INGRESO">Mayor ingreso</option><option value="NOMBRE">Nombre (A-Z)</option>
      </select>
      <span className="cbt-count">{d ? `${miles(d.total)} ${d.total === 1 ? 'comprador' : 'compradores'}${filtrado ? (d.total === 1 ? ' encontrado' : ' encontrados') : ''}` : '…'}</span>
    </div>

    <div className={`cbt-scroll${res.isFetching && !res.isLoading ? ' cbt-busy' : ''}`}>
      <table className="cbt-table">
        <colgroup><col style={{ width: '25%' }} /><col style={{ width: '9%' }} /><col style={{ width: '13%' }} /><col style={{ width: '16%' }} /><col style={{ width: '9%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /></colgroup>
        <thead><tr><th>Comprador</th><th>Canal</th><th>Registro</th><th>Primera compra</th><th className="num">Pedidos</th><th className="num">Monto base</th><th className="num">Ingreso</th></tr></thead>
        <tbody>
          {res.isLoading ? <tr><td colSpan={7} className="cbt-empty">Cargando compradores…</td></tr>
            : res.isError ? <tr><td colSpan={7} className="cbt-empty">No se pudieron cargar los compradores.</td></tr>
              : filas.length ? filas.map(b => <tr key={b.atribucionId}>
                <td><div className="cbt-two"><strong title={b.nombre}>{b.nombre}</strong><small title={b.emailEnmascarado}>{b.emailEnmascarado}</small></div></td>
                <td><span className="cbt-chip">{b.canal === 'WEB' ? 'Web' : 'App'}</span></td>
                <td>{fecha(b.registradoEn)}</td>
                <td>{b.primeraCompraEn ? fecha(b.primeraCompraEn) : <span className="cbt-muted">Aún no compra</span>}</td>
                <td className="num">{miles(b.pedidos)}</td>
                <td className="num">{formatCurrency(b.montoBase)}</td>
                <td className="num"><strong className="cbt-green">{formatCurrency(b.ingresoCaptador)}</strong></td>
              </tr>)
                : <tr><td colSpan={7} className="cbt-empty">{filtrado ? 'Ningún comprador coincide con los filtros.' : 'Este captador aún no tiene compradores referidos.'}</td></tr>}
        </tbody>
      </table>
    </div>

    {d && d.total > 0 && <div className="cbt-foot">
      <span>Mostrando <b>{miles(desde)}–{miles(hasta)}</b> de <b>{miles(d.total)}</b></span>
      <label className="cbt-size">Filas por página
        <select value={tamano} onChange={e => cambiar(setTamano)(Number(e.target.value))}>{TAMANOS.map(t => <option key={t} value={t}>{t}</option>)}</select>
      </label>
      <nav className="cbt-pages" aria-label="Paginación">
        <button type="button" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} aria-label="Página anterior"><UiIcon name="arrowLeft" /></button>
        {paginas(pagina, totalPaginas).map((p, i) => p === '…'
          ? <span key={`e${i}`} className="cbt-gap">…</span>
          : <button key={p} type="button" className={p === pagina ? 'on' : ''} aria-current={p === pagina ? 'page' : undefined} onClick={() => setPagina(p)}>{p + 1}</button>)}
        <button type="button" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(pagina + 1)} aria-label="Página siguiente"><UiIcon name="arrowRight" /></button>
      </nav>
    </div>}
  </div>;
}

const cbtCss = `
.cbt{display:grid;gap:12px;min-width:0;overflow-wrap:normal;word-break:normal}
.cbt *{box-sizing:border-box}
.cbt svg{width:15px;height:15px;flex:0 0 auto}
.cbt-sum{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.cbt-sum div{display:grid;gap:3px;padding:11px 12px;border-radius:12px;background:#f5f8fd;min-width:0}
.cbt-sum small{font-size:11px;font-weight:700;color:#5b6f96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbt-sum strong{font-size:17px;font-weight:850;color:#0f2c5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbt-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.cbt-bar select,.cbt-size select{height:36px;padding:0 9px;border:1px solid #d6e2f2;border-radius:9px;background:#fff;font:inherit;font-size:13px;color:#0f2c5c}
.cbt-search{display:flex;align-items:center;gap:7px;flex:1 1 220px;min-width:180px;height:36px;padding:0 10px;border:1px solid #d6e2f2;border-radius:9px;background:#fff;color:#7a8bab}
.cbt-search:focus-within{border-color:#1657d9;box-shadow:0 0 0 3px #e6efff}
.cbt-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:13px;color:#0f2c5c}
.cbt-search button{display:grid;place-items:center;padding:3px;border:0;border-radius:6px;background:transparent;color:#7a8bab;cursor:pointer}
.cbt-count{margin-left:auto;padding:4px 10px;border-radius:99px;background:#e6efff;color:#1447b8;font-size:12px;font-weight:800;white-space:nowrap}
.cbt-scroll{max-height:520px;overflow:auto;border:1px solid #e6edf7;border-radius:12px;background:#fff;transition:opacity .15s}
.cbt-busy{opacity:.6}
.cbt .cbt-scroll .cbt-table{width:100%;min-width:840px;table-layout:fixed;border-collapse:separate;border-spacing:0;font-size:13px}
.cbt .cbt-scroll .cbt-table th{position:sticky;top:0;z-index:1;padding:10px 12px;text-align:left;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7a8bab;background:#f8fafd;border-bottom:1px solid #e6edf7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbt .cbt-scroll .cbt-table td{padding:10px 12px;border-bottom:1px solid #f1f5fb;color:#31456e;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbt .cbt-scroll .cbt-table tbody tr:last-child td{border-bottom:0}
.cbt .cbt-scroll .cbt-table tbody tr:hover td{background:#f8fbff}
.cbt .cbt-scroll .cbt-table .num{text-align:right}
.cbt-two{display:grid;min-width:0}
.cbt-two strong{font-size:13px;color:#0f2c5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbt-two small{margin-top:2px;font-size:11.5px;color:#7a8bab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbt-chip{display:inline-block;padding:3px 9px;border-radius:99px;background:#eef2f9;color:#52678f;font-size:11.5px;font-weight:800}
.cbt-muted{color:#93a4c0}
.cbt-green{color:#087b42}
.cbt-empty{padding:26px 12px!important;text-align:center;color:#7a8bab;white-space:normal!important}
.cbt-foot{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;font-size:12.5px;color:#5b6f96}
.cbt-foot b{color:#0f2c5c}
.cbt-size{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.cbt-size select{height:32px}
.cbt-pages{display:flex;align-items:center;gap:4px;margin-left:auto}
.cbt-pages button{display:grid;place-items:center;min-width:32px;height:32px;padding:0 8px;border:1px solid #d6e2f2;border-radius:8px;background:#fff;font:inherit;font-size:12.5px;font-weight:800;color:#31456e;cursor:pointer}
.cbt-pages button:hover:not(:disabled){border-color:#1657d9;color:#1447b8}
.cbt-pages button.on{background:#1657d9;border-color:#1657d9;color:#fff}
.cbt-pages button:disabled{opacity:.4;cursor:default}
.cbt-gap{padding:0 3px;color:#93a4c0}
@media (max-width:760px){.cbt-sum{grid-template-columns:repeat(2,minmax(0,1fr))}.cbt-count{margin-left:0}.cbt-pages{margin-left:0}}
`;
