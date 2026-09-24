import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as api from '@/api/capturers';
import { resolveProfileImageUrl } from '@/api/client';
import { getCapturedBuyers, listSocialAdmin, socialMediaUrl } from '@/api/capturerSocial';
import UiIcon from '@/components/shared/UiIcon';
import { formatCurrency } from '@/utils/formatters';
import type { CapturedBusiness, CapturerProfile } from '@/types/capturer';
import type { SocialNivelCodigo } from '@/types/capturerSocial';
import { socialCategoriaLabel, socialFiltroCss } from '@/types/capturerSocial';
import { NIVEL_META, NivelBadge, estadoNegocio, medalCss, pct } from './capturerMetricsUi';
import CapturedBuyersTable from './CapturedBuyersTable';

type Tab = 'resumen' | 'negocios' | 'compradores' | 'redes';
type Props = { c: CapturerProfile; ranking?: { posicion: number; puntos: number }; close: () => void };

const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const mesActual = () => new Date().toISOString().slice(0, 7);
const mesTexto = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const t = new Date(y, m - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// Escalera de niveles del repositorio de redes (misma regla que el backend: 2 pts por comprador con su primera compra).
const NIVELES: Array<{ codigo: SocialNivelCodigo; puntos: number; cupo: number | null }> = [
  { codigo: 'BRONCE', puntos: 0, cupo: 3 },
  { codigo: 'PLATA', puntos: 200, cupo: 6 },
  { codigo: 'ORO', puntos: 400, cupo: 10 },
  { codigo: 'PLATINO', puntos: 1000, cupo: 30 },
  { codigo: 'DIAMANTE', puntos: 2500, cupo: null },
];
const PUNTOS_POR_COMPRADOR = 2;
const VIDEOS_REQUERIDOS = 3;
const iniciales = (n: string) => n.split(' ').filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase();

/** Detalle del captador (Mediación y confianza → Captadores): perfil, negocios, compradores y redes. */
export default function CapturerDetailModal({ c, ranking, close }: Props) {
  const [tab, setTab] = useState<Tab>('resumen');
  const [periodo, setPeriodo] = useState(mesActual());
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Totales históricos (sin periodo) y del mes elegido.
  const historico = useQuery({ queryKey: ['capturer-businesses', c.id], queryFn: () => api.getCapturedBusinesses(c.id), staleTime: 60_000 });
  const delMes = useQuery({ queryKey: ['capturer-businesses', c.id, periodo], queryFn: () => api.getCapturedBusinesses(c.id, periodo) });
  // Solo los totales del captador (la tabla paginada vive en la pestaña Compradores).
  const compradores = useQuery({ queryKey: ['trust-capturer-buyers', c.id, 'resumen'], queryFn: () => getCapturedBuyers(c.id, { pagina: 0, tamano: 1 }) });
  const redes = useQuery({
    queryKey: ['trust-capturer-social', c.id],
    queryFn: () => listSocialAdmin({ q: c.alias, pagina: 0, tamano: 100 }),
    select: d => d.contenido.filter(x => x.autorId === c.id),
  });

  const casas = historico.data?.casasRepuestos ?? [];
  const servicios = historico.data?.serviciosAutomotrices ?? [];
  const mes = [...(delMes.data?.casasRepuestos ?? []), ...(delMes.data?.serviciosAutomotrices ?? [])];
  const montoMes = mes.reduce((n, x) => n + Number(x.ventas || 0), 0);
  const ingresoMesNegocios = mes.reduce((n, x) => n + Number(x.ingresoCaptador || 0), 0);
  const ingresoCompradores = Number(compradores.data?.ingreso ?? 0);
  const referidos = compradores.data?.referidos ?? c.compradoresCaptados ?? 0;
  const convertidos = compradores.data?.conCompra ?? c.compradoresConvertidos ?? 0;
  const piezas = redes.data ?? [];
  const avatar = resolveProfileImageUrl(c.fotoPerfil);

  function copiarCodigo() {
    if (!c.codigoReferido) return;
    void navigator.clipboard.writeText(c.codigoReferido);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  }

  const tabs: Array<{ id: Tab; label: string; icon: string; count?: number }> = [
    { id: 'resumen', label: 'Resumen', icon: 'dashboard' },
    { id: 'negocios', label: 'Casas y servicios', icon: 'store', count: casas.length + servicios.length },
    { id: 'compradores', label: 'Compradores', icon: 'cart', count: referidos },
    { id: 'redes', label: 'Redes sociales', icon: 'megaphone', count: piezas.length },
  ];

  return <div className="cpd-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <style>{cpdCss + medalCss}</style>
    <section className="cpd" role="dialog" aria-modal="true" aria-labelledby="cpd-title">
      <header className="cpd-hero">
        <button type="button" className="cpd-x" onClick={close} aria-label="Cerrar"><UiIcon name="close" /></button>
        <span className="cpd-avatar">{avatar ? <img src={avatar} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : iniciales(c.nombre)}</span>
        <div className="cpd-id">
          <div className="cpd-name-row">
            <h2 id="cpd-title">{c.nombre}</h2>
            <span className={`cpd-pill ${c.activo ? 'on' : 'off'}`}>{c.activo ? 'Activo' : 'Suspendido'}</span>
            <NivelBadge nivel={c.nivelSocial} />
          </div>
          <p className="cpd-alias">@{c.alias}</p>
          <div className="cpd-meta">
            <span><UiIcon name="mail" />{c.email}</span>
            <span><UiIcon name="phone" />{c.telefono || 'Sin teléfono'}</span>
            <span><UiIcon name="target" />{c.comuna}, {c.region}</span>
            <span><UiIcon name="calendar" />Desde {fecha(c.createdAt)}</span>
          </div>
        </div>
        <div className="cpd-code">
          <small>Código de referido</small>
          <strong>{c.codigoReferido || '—'}</strong>
          {c.codigoReferido && <button type="button" onClick={copiarCodigo}><UiIcon name={copiado ? 'check' : 'clipboard'} />{copiado ? 'Copiado' : 'Copiar'}</button>}
        </div>
      </header>

      <div className="cpd-kpis">
        <Kpi label="Ganancia del mes" value={formatCurrency(Number(c.gananciaMes ?? 0))} foot="Comisiones del periodo" tone="green" />
        <Kpi label="Ranking global" value={ranking ? `#${ranking.posicion}` : '—'} foot={ranking ? `${ranking.puntos.toLocaleString('es-CL')} pts acumulados` : 'Sin puntos aún'} tone="amber" />
        <Kpi label="Casas captadas" value={String(casas.length)} foot="Casas de repuestos" tone="blue" loading={historico.isLoading} />
        <Kpi label="Servicios captados" value={String(servicios.length)} foot="Talleres y servicios" tone="violet" loading={historico.isLoading} />
        <Kpi label="Compradores" value={`${convertidos.toLocaleString('es-CL')}/${referidos.toLocaleString('es-CL')}`} foot="Con compra / referidos" tone="blue" />
        <Kpi label="Puntos redes" value={(c.puntosSociales ?? 0).toLocaleString('es-CL')} foot={`${PUNTOS_POR_COMPRADOR} pts por comprador`} tone="violet" />
      </div>

      <nav className="cpd-tabs" role="tablist">
        {tabs.map(t => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
          <UiIcon name={t.icon} />{t.label}{t.count !== undefined && <em>{t.count.toLocaleString('es-CL')}</em>}
        </button>)}
      </nav>

      <div className="cpd-body">
        {tab === 'resumen' && <div className="cpd-grid2">
          <Card title="Datos del captador" icon="user">
            <dl className="cpd-dl">
              <Dato k="Nombre" v={c.nombre} />
              <Dato k="RUT" v={c.rut || '—'} />
              <Dato k="Correo" v={c.email} />
              <Dato k="Teléfono" v={c.telefono || '—'} />
              <Dato k="Región" v={c.region} />
              <Dato k="Comuna" v={c.comuna} />
              <Dato k="Código" v={c.codigoReferido || '—'} />
              <Dato k="Registro" v={fecha(c.createdAt)} />
              <Dato k="Cuenta" v={c.activo ? 'Activa' : 'Suspendida'} />
              <Dato k="Medalla" v={<NivelBadge nivel={c.nivelSocial} />} />
            </dl>
          </Card>
          <Card title="Desempeño del periodo" icon="trendUp" action={<input className="cpd-month" type="month" value={periodo} onChange={e => setPeriodo(e.target.value || mesActual())} aria-label="Periodo" />}>
            <div className="cpd-perf">
              <div><small>Monto base de negocios</small><strong>{delMes.isLoading ? '…' : formatCurrency(montoMes)}</strong></div>
              <div><small>Ingreso por negocios</small><strong className="cpd-green">{delMes.isLoading ? '…' : formatCurrency(ingresoMesNegocios)}</strong></div>
            </div>
            <p className="cpd-note">{mesTexto(periodo)} · ventas de casas referidas y compras de fichas de servicios referidos.</p>
            <h4 className="cpd-h4">Composición de la cartera</h4>
            <Barra label="Casas de repuestos" valor={casas.length} total={casas.length + servicios.length + referidos} color="#1657d9" />
            <Barra label="Servicios automotrices" valor={servicios.length} total={casas.length + servicios.length + referidos} color="#6d3fd6" />
            <Barra label="Compradores referidos" valor={referidos} total={casas.length + servicios.length + referidos} color="#0f8a4d" />
            <div className="cpd-perf cpd-perf-sm">
              <div><small>Conversión de compradores</small><strong>{pct(convertidos, referidos)}</strong></div>
              <div><small>Ingreso por compradores</small><strong className="cpd-green">{compradores.isLoading ? '…' : formatCurrency(ingresoCompradores)}</strong></div>
            </div>
          </Card>
        </div>}

        {tab === 'negocios' && <Negocios id={c.id} periodo={periodo} setPeriodo={setPeriodo} historico={[...casas, ...servicios]} delMes={mes} cargando={historico.isLoading || delMes.isLoading} />}

        {tab === 'compradores' && <Card title="Compradores referidos" icon="cart">
          <CapturedBuyersTable captadorId={c.id} resumen />
        </Card>}

        {tab === 'redes' && <NivelRedes puntos={c.puntosSociales ?? 0} nivel={c.nivelSocial} piezas={piezas} cargando={redes.isLoading} />}

        {tab === 'redes' && <Card title="Contenido en el repositorio de redes" icon="megaphone">
          <div className="cpd-mini">
            <Mini label="Piezas publicadas" value={String(piezas.filter(p => p.estado === 'PUBLICADO').length)} />
            <Mini label="Videos / imágenes" value={`${piezas.filter(p => p.tipo === 'VIDEO').length} / ${piezas.filter(p => p.tipo === 'IMAGEN').length}`} />
            <Mini label="Descargas recibidas" value={String(piezas.reduce((n, p) => n + p.descargasTotal, 0))} />
            <Mini label="Evaluación promedio" value={promedio(piezas)} />
          </div>
          {redes.isLoading ? <p className="cpd-empty">Cargando contenido…</p>
            : piezas.length ? <div className="cpd-pieces">{piezas.map(p => <article key={p.id} className="cpd-piece">
              <div className="cpd-thumb">
                {p.tipo === 'VIDEO'
                  ? (p.posterUrl ? <img src={socialMediaUrl(p.posterUrl)} alt="" style={{ filter: socialFiltroCss(p.filtroVisual) }} /> : <video src={socialMediaUrl(p.url)} muted preload="metadata" style={{ filter: socialFiltroCss(p.filtroVisual) }} />)
                  : <img src={socialMediaUrl(p.url)} alt="" style={{ filter: socialFiltroCss(p.filtroVisual) }} />}
                <span className="cpd-thumb-type">{p.tipo === 'VIDEO' ? '▶ Video' : 'Imagen'}</span>
                {p.estado === 'OCULTO' && <span className="cpd-thumb-hidden">Oculto</span>}
              </div>
              <div className="cpd-piece-body">
                <strong title={p.titulo}>{p.titulo}</strong>
                <small>{socialCategoriaLabel(p.categoria)} · {fecha(p.creadoEn)}</small>
                <div className="cpd-piece-stats"><span title="Descargas">⬇ {p.descargasTotal}</span><span title="Evaluación promedio">★ {p.calificacionCount ? `${Number(p.calificacionPromedio).toFixed(1)} (${p.calificacionCount})` : '—'}</span></div>
                {p.estado === 'OCULTO' && p.motivoOcultamiento && <small className="cpd-hidden-note" title={p.motivoOcultamiento}>Oculto: {p.motivoOcultamiento}</small>}
              </div>
            </article>)}</div>
              : <p className="cpd-empty">Este captador aún no sube contenido al repositorio.</p>}
        </Card>}
      </div>
    </section>
  </div>;
}

function Negocios({ periodo, setPeriodo, historico, delMes, cargando }: { id: number; periodo: string; setPeriodo: (p: string) => void; historico: CapturedBusiness[]; delMes: CapturedBusiness[]; cargando: boolean }) {
  const [tipo, setTipo] = useState('TODOS');
  const [q, setQ] = useState('');
  // Montos del mes elegido sobre la lista completa de negocios (un negocio sin movimientos queda en $0).
  const porId = useMemo(() => new Map(delMes.map(x => [`${x.tipo}-${x.id}`, x])), [delMes]);
  const filas = historico
    .map(x => ({ ...x, mes: porId.get(`${x.tipo}-${x.id}`) }))
    .filter(x => (tipo === 'TODOS' || x.tipo === tipo)
      && [x.nombre, x.email, x.region, x.comuna].join(' ').toLowerCase().includes(q.trim().toLowerCase()));
  const monto = filas.reduce((n, x) => n + Number(x.mes?.ventas ?? 0), 0);
  const ingreso = filas.reduce((n, x) => n + Number(x.mes?.ingresoCaptador ?? 0), 0);
  return <Card title="Casas y servicios captados" icon="store" action={<span className="cpd-count">{filas.length} {filas.length === 1 ? 'negocio' : 'negocios'}</span>}>
    <div className="cpd-filters">
      <label><small>Mes de los montos</small><input type="month" value={periodo} onChange={e => setPeriodo(e.target.value || mesActual())} /></label>
      <label><small>Tipo</small><select value={tipo} onChange={e => setTipo(e.target.value)}>
        <option value="TODOS">Todos</option><option value="CASA_REPUESTOS">Casas de repuestos</option><option value="SERVICIO">Servicios automotrices</option>
      </select></label>
      <label className="grow"><small>Buscar</small><input value={q} maxLength={80} onChange={e => setQ(e.target.value)} placeholder="Negocio, correo, región o comuna" /></label>
    </div>
    <div className="cpd-mini">
      <Mini label="Negocios" value={String(filas.length)} />
      <Mini label="Aprobados" value={String(filas.filter(x => estadoNegocio(x.estado).tone === 'on').length)} />
      <Mini label="Monto base del mes" value={formatCurrency(monto)} />
      <Mini label="Ingreso del captador" value={formatCurrency(ingreso)} green />
    </div>
    <div className="cpd-table-wrap">
      <table className="cpd-table">
        <colgroup><col style={{ width: '28%' }} /><col style={{ width: '16%' }} /><col style={{ width: '18%' }} /><col style={{ width: '12%' }} /><col style={{ width: '13%' }} /><col style={{ width: '13%' }} /></colgroup>
        <thead><tr><th>Negocio</th><th>Tipo</th><th>Ubicación</th><th>Estado</th><th className="num">Monto base</th><th className="num">Ingreso</th></tr></thead>
        <tbody>{cargando ? <tr><td colSpan={6} className="cpd-empty">Cargando negocios…</td></tr>
          : filas.length ? filas.map(x => {
            const est = estadoNegocio(x.estado);
            return <tr key={`${x.tipo}-${x.id}`}>
              <td><Dos a={x.nombre} b={x.email} /></td>
              <td><span className={`cpd-chip ${x.tipo === 'CASA_REPUESTOS' ? 'blue' : 'violet'}`}>{x.tipo === 'CASA_REPUESTOS' ? 'Casa de repuestos' : 'Servicio automotriz'}</span></td>
              <td><Dos a={x.comuna} b={x.region} /></td>
              <td><span className={`cpd-pill ${est.tone}`}>{est.label}</span></td>
              <td className="num">{formatCurrency(Number(x.mes?.ventas ?? 0))}</td>
              <td className="num"><strong className="cpd-green">{formatCurrency(Number(x.mes?.ingresoCaptador ?? 0))}</strong></td>
            </tr>;
          }) : <tr><td colSpan={6} className="cpd-empty">No hay negocios para los filtros seleccionados.</td></tr>}
        </tbody>
      </table>
    </div>
  </Card>;
}

function NivelRedes({ puntos, nivel, piezas, cargando }: { puntos: number; nivel?: string | null; piezas: Array<{ tipo: string; estado: string; creadoEn: string }>; cargando: boolean }) {
  const porCodigo = NIVELES.findIndex(n => n.codigo === nivel);
  const porPuntos = NIVELES.reduce((acc, n, i) => (puntos >= n.puntos ? i : acc), 0);
  const idx = porCodigo >= 0 ? porCodigo : porPuntos;
  const actual = NIVELES[idx] ?? NIVELES[0]!;
  const siguiente = NIVELES[idx + 1];
  const progreso = siguiente ? Math.max(0, Math.min(100, Math.round(((puntos - actual.puntos) / (siguiente.puntos - actual.puntos)) * 100))) : 100;
  const faltan = siguiente ? Math.max(0, siguiente.puntos - puntos) : 0;
  const hace7 = Date.now() - 7 * 86_400_000;
  const videos7 = piezas.filter(p => p.tipo === 'VIDEO' && p.estado === 'PUBLICADO' && new Date(p.creadoEn).getTime() >= hace7).length;
  const acceso = videos7 >= VIDEOS_REQUERIDOS;
  const color = NIVEL_META[actual.codigo].color;
  return <Card title="Nivel y acceso al repositorio" icon="star">
    <div className="cpd-level">
      <div className="cpd-level-main">
        <span className="cpd-medal" style={{ background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.55), transparent 55%), ${color}` }}>{idx + 1}</span>
        <div className="cpd-level-info">
          <div className="cpd-level-title"><strong>{NIVEL_META[actual.codigo].label}</strong><span>{puntos.toLocaleString('es-CL')} pts</span></div>
          <div className="cpd-progress"><i style={{ width: `${progreso}%`, background: siguiente ? `linear-gradient(90deg, ${color}, ${NIVEL_META[siguiente.codigo].color})` : color }} /></div>
          <small>{siguiente
            ? `Faltan ${faltan.toLocaleString('es-CL')} pts para ${NIVEL_META[siguiente.codigo].label} (${Math.ceil(faltan / PUNTOS_POR_COMPRADOR).toLocaleString('es-CL')} compradores más con su primera compra)`
            : 'Nivel máximo alcanzado'}</small>
        </div>
      </div>
      <div className="cpd-level-facts">
        <div><small>Cupo semanal</small><strong>{actual.cupo === null ? 'Ilimitado' : `${actual.cupo} descargas`}</strong></div>
        <div><small>Videos en 7 días</small><strong>{cargando ? '…' : `${Math.min(videos7, VIDEOS_REQUERIDOS)}/${VIDEOS_REQUERIDOS}`}</strong></div>
        <div><small>Acceso</small><strong>{cargando ? '…' : <span className={`cpd-pill ${acceso ? 'on' : 'wait'}`}>{acceso ? 'Activo' : 'Sin acceso'}</span>}</strong></div>
      </div>
    </div>
    <ol className="cpd-ladder">
      {NIVELES.map((n, i) => <li key={n.codigo} className={i === idx ? 'on' : i < idx ? 'done' : ''}>
        <i style={{ background: NIVEL_META[n.codigo].color }} />
        <strong>{NIVEL_META[n.codigo].label}</strong>
        <small>{n.puntos.toLocaleString('es-CL')} pts · {n.cupo === null ? 'ilimitadas' : `${n.cupo}/semana`}</small>
      </li>)}
    </ol>
  </Card>;
}

function promedio(piezas: Array<{ calificacionPromedio: number; calificacionCount: number }>) {
  const n = piezas.reduce((s, p) => s + p.calificacionCount, 0);
  if (!n) return '—';
  const total = piezas.reduce((s, p) => s + Number(p.calificacionPromedio) * p.calificacionCount, 0);
  return `★ ${(total / n).toFixed(1)}`;
}

function Kpi({ label, value, foot, tone, loading }: { label: string; value: string; foot: string; tone: 'green' | 'amber' | 'blue' | 'violet'; loading?: boolean }) {
  return <div className={`cpd-kpi ${tone}`}><small>{label}</small><strong>{loading ? '…' : value}</strong><span>{foot}</span></div>;
}
function Mini({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return <div className="cpd-mini-item"><small>{label}</small><strong className={green ? 'cpd-green' : undefined}>{value}</strong></div>;
}
function Card({ title, icon, action, children }: { title: string; icon: string; action?: ReactNode; children: ReactNode }) {
  return <section className="cpd-card"><div className="cpd-card-head"><h3><UiIcon name={icon} />{title}</h3>{action}</div>{children}</section>;
}
function Dato({ k, v }: { k: string; v: ReactNode }) {
  return <div><dt>{k}</dt><dd title={typeof v === 'string' ? v : undefined}>{v}</dd></div>;
}
function Dos({ a, b }: { a: string; b?: string | null }) {
  return <div className="cpd-two"><strong title={a}>{a}</strong>{b && <small title={b}>{b}</small>}</div>;
}
function Barra({ label, valor, total, color }: { label: string; valor: number; total: number; color: string }) {
  const p = total > 0 ? Math.round((valor / total) * 100) : 0;
  return <div className="cpd-bar"><span>{label}</span><div><i style={{ width: `${Math.max(valor > 0 ? 4 : 0, p)}%`, background: color }} /></div><b>{valor}</b></div>;
}

const cpdCss = `
.cpd-overlay{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:20px;background:rgba(3,22,58,.55);backdrop-filter:blur(2px)}
.cpd{display:flex;flex-direction:column;width:min(1080px,100%);max-height:min(92vh,960px);overflow:hidden;border-radius:20px;background:#f6f8fc;box-shadow:0 30px 80px rgba(3,22,58,.35);color:#0f2c5c;font-family:Inter,system-ui,sans-serif;overflow-wrap:normal;word-break:normal}
.cpd *{box-sizing:border-box}
.cpd svg{width:16px;height:16px;flex:0 0 auto}
.cpd-hero{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:18px;align-items:center;padding:22px 26px;background:linear-gradient(120deg,#0b2559 0%,#1447b8 60%,#1f63e0 100%);color:#fff}
.cpd-x{position:absolute;top:12px;right:12px;display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:10px;background:rgba(255,255,255,.14);color:#fff;cursor:pointer}
.cpd-x:hover{background:rgba(255,255,255,.26)}
.cpd-avatar{display:grid;place-items:center;width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.18);box-shadow:0 0 0 3px rgba(255,255,255,.35);font-size:24px;font-weight:850;overflow:hidden}
.cpd-avatar img{width:100%;height:100%;object-fit:cover}
.cpd-id{min-width:0}
.cpd-name-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.cpd-name-row h2{margin:0;font-size:22px;font-weight:850;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.cpd-name-row .cpx-medal{background:#fff}
.cpd-alias{margin:2px 0 10px;font-size:14px;font-weight:700;color:#bcd3ff}
.cpd-meta{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;color:#dbe7ff}
.cpd-meta span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.cpd-code{display:grid;gap:4px;justify-items:start;padding:12px 14px;margin-right:30px;border-radius:14px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2)}
.cpd-code small{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#bcd3ff}
.cpd-code strong{font-size:16px;font-weight:850;letter-spacing:.02em;white-space:nowrap}
.cpd-code button{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:0;border-radius:8px;background:#fff;color:#1447b8;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
.cpd-pill{display:inline-block;padding:4px 10px;border-radius:99px;font-size:11.5px;font-weight:800;white-space:nowrap}
.cpd-pill.on{background:#dcf7e8;color:#087b42}.cpd-pill.off{background:#ffe1e6;color:#c81e3e}.cpd-pill.wait{background:#fef2e0;color:#a86a08}.cpd-pill.neutral{background:#eef2f9;color:#52678f}
.cpd-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;padding:16px 26px 4px}
.cpd-kpi{display:grid;gap:3px;padding:12px 13px;border-radius:14px;background:#fff;border:1px solid #e3ebf7;border-top:3px solid var(--k,#1657d9);min-width:0}
.cpd-kpi.green{--k:#0f8a4d}.cpd-kpi.amber{--k:#d49a1a}.cpd-kpi.blue{--k:#1657d9}.cpd-kpi.violet{--k:#6d3fd6}
.cpd-kpi small{font-size:11px;font-weight:700;color:#5b6f96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-kpi strong{font-size:20px;font-weight:850;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-kpi span{font-size:11px;color:#7a8bab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-tabs{display:flex;gap:6px;padding:12px 26px 0;overflow-x:auto;border-bottom:1px solid #e3ebf7}
.cpd-tabs button{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:0;border-bottom:3px solid transparent;background:transparent;font:inherit;font-size:13.5px;font-weight:750;color:#5b6f96;white-space:nowrap;cursor:pointer}
.cpd-tabs button:hover{color:#1447b8}
.cpd-tabs button.on{color:#1447b8;border-bottom-color:#1657d9}
.cpd-tabs em{font-style:normal;padding:1px 8px;border-radius:99px;background:#e6efff;color:#1447b8;font-size:11.5px;font-weight:800}
.cpd-body{flex:1;min-height:0;overflow:auto;padding:18px 26px 26px}
.cpd-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:14px;align-items:start}
.cpd-card{padding:16px 18px;border-radius:16px;background:#fff;border:1px solid #e3ebf7;box-shadow:0 6px 18px rgba(15,44,92,.04);min-width:0}
.cpd-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.cpd-card-head h3{display:flex;align-items:center;gap:8px;margin:0;font-size:15px;font-weight:850;color:#0f2c5c}
.cpd-card-head h3 svg{color:#1657d9}
.cpd-dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;margin:0}
.cpd-dl div{min-width:0;padding-bottom:9px;border-bottom:1px dashed #e6edf7}
.cpd-dl dt{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#7a8bab}
.cpd-dl dd{margin:3px 0 0;font-size:13.5px;font-weight:650;color:#0f2c5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-month,.cpd-filters input,.cpd-filters select{height:36px;padding:0 10px;border:1px solid #d6e2f2;border-radius:9px;background:#fff;font:inherit;font-size:13px;color:#0f2c5c}
.cpd-perf{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.cpd-perf div{display:grid;gap:3px;padding:12px;border-radius:12px;background:#f5f8fd}
.cpd-perf small{font-size:11.5px;font-weight:700;color:#5b6f96}
.cpd-perf strong{font-size:20px;font-weight:850;white-space:nowrap}
.cpd-perf-sm{margin-top:12px}
.cpd-perf-sm strong{font-size:16px}
.cpd-note{margin:8px 0 0;font-size:11.5px;color:#7a8bab}
.cpd-h4{margin:16px 0 8px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#7a8bab}
.cpd-bar{display:grid;grid-template-columns:150px minmax(0,1fr) 34px;gap:10px;align-items:center;padding:4px 0;font-size:12.5px;color:#31456e}
.cpd-bar span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-bar div{height:9px;border-radius:99px;background:#eef2f9;overflow:hidden}
.cpd-bar i{display:block;height:100%;border-radius:99px;transition:width .5s}
.cpd-bar b{text-align:right;color:#0f2c5c}
.cpd-green{color:#087b42!important;background:none!important}
.cpd-mini{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
.cpd-mini-item{display:grid;gap:3px;padding:11px 12px;border-radius:12px;background:#f5f8fd;min-width:0}
.cpd-mini-item small{font-size:11px;font-weight:700;color:#5b6f96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-mini-item strong{font-size:17px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-filters{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px}
.cpd-filters label{display:grid;gap:4px;min-width:150px}
.cpd-filters label.grow{flex:1 1 220px}
.cpd-filters small{font-size:11px;font-weight:800;color:#5b6f96}
.cpd-count{padding:4px 10px;border-radius:99px;background:#e6efff;color:#1447b8;font-size:12px;font-weight:800;white-space:nowrap}
.cpd-table-wrap{overflow-x:auto;border:1px solid #e6edf7;border-radius:12px}
.cpd-table{width:100%;min-width:840px;table-layout:fixed;border-collapse:collapse;font-size:13px}
.cpd-table th{padding:11px 12px;text-align:left;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7a8bab;background:#f8fafd;border-bottom:1px solid #e6edf7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-table td{padding:11px 12px;border-bottom:1px solid #f1f5fb;color:#31456e;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-table tbody tr:last-child td{border-bottom:0}
.cpd-table tbody tr:hover{background:#f8fbff}
.cpd-table .num{text-align:right}
.cpd-two{display:grid;min-width:0}
.cpd-two strong{font-size:13px;color:#0f2c5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-two small{margin-top:2px;font-size:11.5px;color:#7a8bab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-chip{display:inline-block;max-width:100%;padding:4px 9px;border-radius:99px;background:#eef2f9;color:#52678f;font-size:11.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
.cpd-chip.blue{background:#e9f1ff;color:#1d59bf}.cpd-chip.violet{background:#f1eaff;color:#6d3fd6}
.cpd-muted{color:#93a4c0}
.cpd-empty{padding:26px 12px!important;text-align:center;color:#7a8bab;white-space:normal!important}
.cpd-pieces{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.cpd-piece{border:1px solid #e6edf7;border-radius:14px;overflow:hidden;background:#fff}
.cpd-thumb{position:relative;aspect-ratio:4/5;background:#0b1730}
.cpd-thumb img,.cpd-thumb video{width:100%;height:100%;object-fit:cover;display:block}
.cpd-thumb-type,.cpd-thumb-hidden{position:absolute;top:8px;padding:3px 8px;border-radius:99px;font-size:10.5px;font-weight:800;color:#fff;background:rgba(9,20,45,.65)}
.cpd-thumb-type{left:8px}.cpd-thumb-hidden{right:8px;background:#c81e3e}
.cpd-piece-body{display:grid;gap:3px;padding:10px 11px}
.cpd-piece-body strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.6em;font-size:13px;line-height:1.3}
.cpd-piece-body small{font-size:11.5px;color:#7a8bab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-hidden-note{font-size:11px;color:#c81e3e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-body>.cpd-card+.cpd-card{margin-top:14px}
.cpd-level{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px;align-items:center}
.cpd-level-main{display:flex;align-items:center;gap:14px;min-width:0}
.cpd-medal{display:grid;place-items:center;flex:0 0 auto;width:54px;height:54px;border-radius:50%;color:#fff;font-size:20px;font-weight:900;box-shadow:inset 0 -4px 0 rgba(0,0,0,.15),0 6px 14px rgba(15,44,92,.18);text-shadow:0 1px 2px rgba(0,0,0,.25)}
.cpd-level-info{display:grid;gap:6px;flex:1;min-width:0}
.cpd-level-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.cpd-level-title strong{font-size:17px;font-weight:850}
.cpd-level-title span{font-size:13px;font-weight:800;color:#5b6f96;white-space:nowrap}
.cpd-progress{height:10px;border-radius:99px;background:#eef2f9;overflow:hidden}
.cpd-progress i{display:block;height:100%;border-radius:99px;transition:width .6s}
.cpd-level-info small{font-size:11.5px;color:#7a8bab;line-height:1.35}
.cpd-level-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.cpd-level-facts div{display:grid;gap:4px;padding:10px 11px;border-radius:12px;background:#f5f8fd;min-width:0}
.cpd-level-facts small{font-size:11px;font-weight:700;color:#5b6f96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-level-facts strong{font-size:14.5px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-ladder{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:14px 0 0;padding:0;list-style:none}
.cpd-ladder li{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:7px;align-items:center;padding:9px 10px;border:1px solid #e6edf7;border-radius:11px;background:#fff;opacity:.6;min-width:0}
.cpd-ladder li.done{opacity:.85}
.cpd-ladder li.on{opacity:1;border-color:#1657d9;box-shadow:0 0 0 3px #e6efff}
.cpd-ladder i{grid-row:span 2;width:12px;height:12px;border-radius:50%}
.cpd-ladder strong{font-size:12.5px;font-weight:850}
.cpd-ladder small{font-size:10.5px;color:#7a8bab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cpd-piece-stats{display:flex;gap:12px;margin-top:3px;font-size:12px;font-weight:700;color:#31456e}
@media (max-width:1100px){.cpd-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:980px){.cpd-level{grid-template-columns:minmax(0,1fr)}.cpd-ladder{grid-template-columns:repeat(3,minmax(0,1fr))}.cpd-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.cpd-grid2{grid-template-columns:minmax(0,1fr)}.cpd-hero{grid-template-columns:auto minmax(0,1fr)}.cpd-code{grid-column:1/-1;margin-right:0;grid-template-columns:auto auto auto;align-items:center;justify-content:start;gap:10px}}
@media (max-width:620px){.cpd-overlay{padding:0}.cpd{max-height:100vh;border-radius:0}.cpd-kpis{grid-template-columns:repeat(2,minmax(0,1fr));padding:12px 14px 0}.cpd-hero,.cpd-body{padding-left:14px;padding-right:14px}.cpd-tabs{padding:10px 14px 0}.cpd-mini{grid-template-columns:repeat(2,minmax(0,1fr))}.cpd-dl{grid-template-columns:minmax(0,1fr)}.cpd-level-facts,.cpd-ladder{grid-template-columns:repeat(2,minmax(0,1fr))}.cpd-avatar{width:56px;height:56px;font-size:19px}}
`;
