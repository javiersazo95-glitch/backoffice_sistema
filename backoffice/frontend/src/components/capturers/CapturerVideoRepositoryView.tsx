import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getVideoMetricas, levantarSancionSocial, listSocialSanciones, listVideosAdmin, sancionarCaptadorSocial, setSocialVisibilidad, socialMediaUrl,
} from '@/api/capturerSocial';
import UiIcon from '@/components/shared/UiIcon';
import type { CapturerProfile } from '@/types/capturer';
import type { SocialSancion, VideoAdmin, VideoFiltros, VideoOrden } from '@/types/capturerSocial';
import { SOCIAL_CATEGORIAS, socialCategoriaLabel, socialFiltroCss, socialRedLabel } from '@/types/capturerSocial';
import { Kpi, cpxCss, pct } from './capturerMetricsUi';
import CapturerAvatar from './CapturerAvatar';

type Props = { all: CapturerProfile[]; onVerCaptador: (id: number) => void };

const hoy = () => new Date().toLocaleDateString('en-CA');
const inicioMes = () => `${hoy().slice(0, 8)}01`;
const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const fechaHora = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const duracion = (s?: number | null) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const peso = (b?: number | null) => {
  const n = Number(b ?? 0);
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
};
const estrellas = (v: VideoAdmin) => (v.calificacionCount ? `★ ${Number(v.calificacionPromedio).toFixed(1)} (${v.calificacionCount})` : 'Sin reseñas');
const errorDe = (err: unknown, fallback: string) => (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;

const ORDENES: Array<{ value: VideoOrden; label: string }> = [
  { value: 'RECIENTES', label: 'Más recientes' },
  { value: 'ANTIGUOS', label: 'Más antiguos' },
  { value: 'MAS_DESCARGADOS', label: 'Más descargados' },
  { value: 'MENOS_DESCARGADOS', label: 'Menos descargados' },
  { value: 'MEJOR_EVALUADOS', label: 'Mejor evaluados' },
  { value: 'PEOR_EVALUADOS', label: 'Peor evaluados (con reseñas)' },
  { value: 'MAS_PESADOS', label: 'Más pesados' },
  { value: 'MODERADOS', label: 'Moderados recientemente' },
];
/** Motivos frecuentes de veto; el texto final lo ve el captador en "Mis contenidos". */
const MOTIVOS = [
  'Contenido inapropiado u ofensivo',
  'Usa marcas o material de terceros sin autorización',
  'Información falsa o engañosa',
  'Promociona otra plataforma o la competencia',
  'Muestra datos personales de terceros',
  'No está relacionado con RepuesTop o es de baja calidad',
  'Otro',
];
const MOTIVO_INICIAL = 'Contenido inapropiado u ofensivo';
const DURACIONES = [3, 7, 14, 30, 90];
const FILTROS_VACIOS: VideoFiltros = { estado: '', categoria: '', captadorId: null, q: '', desde: '', hasta: '', orden: 'RECIENTES', calificacionMax: null };

function armarMotivo(preset: string, detalle: string) {
  const d = detalle.trim();
  if (preset === 'Otro') return d;
  return (d ? `${preset}: ${d}` : preset).slice(0, 300);
}

/** Repositorio de videos de los captadores: todos los videos, métricas, veto y sanción al autor. */
export default function CapturerVideoRepositoryView({ all, onVerCaptador }: Props) {
  const qc = useQueryClient();
  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(hoy());
  const [f, setF] = useState<VideoFiltros>(FILTROS_VACIOS);
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(0);
  const [tamano, setTamano] = useState(12);
  const [modo, setModo] = useState<'GRILLA' | 'TABLA'>('GRILLA');
  const [detalle, setDetalle] = useState<VideoAdmin | null>(null);
  const [vetando, setVetando] = useState<VideoAdmin | null>(null);
  const [sancionando, setSancionando] = useState<VideoAdmin | null>(null);
  const [aviso, setAviso] = useState<{ text: string; err?: boolean } | null>(null);

  // La búsqueda se envía al servidor medio segundo después de dejar de escribir.
  useEffect(() => {
    const t = window.setTimeout(() => { setF(x => (x.q === q ? x : { ...x, q })); setPagina(0); }, 450);
    return () => window.clearTimeout(t);
  }, [q]);

  const rangoValido = !desde || !hasta || desde <= hasta;
  const metricas = useQuery({ queryKey: ['trust-videos-metrics', desde, hasta], queryFn: () => getVideoMetricas(desde, hasta), enabled: rangoValido });
  const videos = useQuery({
    queryKey: ['trust-videos', f, pagina, tamano],
    queryFn: () => listVideosAdmin(f, pagina, tamano),
    placeholderData: keepPreviousData,
    enabled: !f.desde || !f.hasta || f.desde <= f.hasta,
  });
  const m = metricas.data;
  const captadores = useMemo(() => [...all].sort((a, b) => a.alias.localeCompare(b.alias, 'es')), [all]);
  const filtrosActivos = Object.entries(f).filter(([k, v]) => k !== 'orden' && v !== '' && v !== null).length;

  const cambiar = <K extends keyof VideoFiltros>(k: K, v: VideoFiltros[K]) => { setF(x => ({ ...x, [k]: v })); setPagina(0); };
  const limpiar = () => { setF(FILTROS_VACIOS); setQ(''); setPagina(0); };

  async function refrescar(actualizado?: VideoAdmin | null) {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['trust-videos'] }),
      qc.invalidateQueries({ queryKey: ['trust-videos-metrics'] }),
      qc.invalidateQueries({ queryKey: ['trust-capturers-social-contents'] }),
      qc.invalidateQueries({ queryKey: ['trust-capturers-social-metrics'] }),
      qc.invalidateQueries({ queryKey: ['trust-capturer-social'] }),
      qc.invalidateQueries({ queryKey: ['trust-social-sanctions'] }),
    ]);
    if (actualizado !== undefined) setDetalle(d => (d && actualizado && d.id === actualizado.id ? actualizado : d));
  }

  async function quitarVeto(v: VideoAdmin) {
    if (!window.confirm(`¿Quitar el veto a "${v.titulo}"? Volverá a estar disponible en el repositorio.`)) return;
    try {
      await setSocialVisibilidad(v.id, 'RESTAURAR');
      setAviso({ text: `"${v.titulo}" volvió al repositorio.` });
      await refrescar({ ...v, estado: 'PUBLICADO', motivoOcultamiento: null, moderadoAt: new Date().toISOString() });
    } catch (err) {
      setAviso({ text: errorDe(err, 'No se pudo quitar el veto.'), err: true });
    }
  }

  // El perfil del captador se abre sobre la página: se cierra el detalle del video para no taparlo.
  const acciones = { ver: setDetalle, vetar: setVetando, quitarVeto, sancionar: setSancionando, perfil: (id: number) => { setDetalle(null); onVerCaptador(id); } };
  const lista = videos.data?.contenido ?? [];

  return <div className="cpx">
    <style>{cpxCss + css}</style>
    <div className="cpx-head">
      <div><h2>Repositorio de videos</h2><p>Todos los videos que publican los captadores. Revisa, veta los que incumplan las normas y sanciona al autor si corresponde.</p></div>
      <div className="cpx-filters">
        <label className="cpx-field">Métricas desde<input type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} /></label>
        <label className="cpx-field">Hasta<input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} /></label>
      </div>
    </div>
    {!rangoValido && <div className="cpx-note vr-err">La fecha "hasta" no puede ser anterior a "desde".</div>}

    <section className="cpx-kpis vr-kpis">
      <Kpi icon="video" tone="blue" label="Videos en el repositorio" value={m ? m.videosTotal.toLocaleString('es-CL') : '—'} foot={m ? `${m.videosPublicados.toLocaleString('es-CL')} publicados · ${peso(m.almacenamientoBytes)}` : '—'} />
      <Kpi icon="upload" tone="violet" label="Subidos en el periodo" value={m ? m.subidosPeriodo.toLocaleString('es-CL') : '—'} foot={m ? `Duración promedio ${duracion(m.duracionPromedioSeg)}` : '—'} />
      <Kpi icon="download" tone="green" label="Descargas en el periodo" value={m ? m.descargasPeriodo.toLocaleString('es-CL') : '—'} foot={m ? `${m.descargasTotal.toLocaleString('es-CL')} en total` : '—'} />
      <Kpi icon="star" tone="amber" label="Evaluación promedio" value={m ? (m.resenasTotal ? `★ ${Number(m.calificacionPromedio).toFixed(2)}` : '—') : '—'} foot={m ? `${m.resenasTotal.toLocaleString('es-CL')} reseñas` : '—'} />
      <Kpi icon="shieldX" tone="red" label="Videos vetados" value={m ? m.videosVetados.toLocaleString('es-CL') : '—'} foot={m ? `${m.vetadosPeriodo} en el periodo · ${pct(m.videosVetados, m.videosTotal)} del total` : '—'} />
      <Kpi icon="users" tone="blue" label="Captadores publicando" value={m ? m.captadoresPublicando.toLocaleString('es-CL') : '—'} foot={m ? `${m.captadoresSancionados} con sanción vigente` : '—'} />
    </section>

    <section className="cpx-card" id="vr-listado">
      <div className="cpx-head" style={{ marginBottom: 12 }}>
        <div><h3>Todos los videos</h3><p style={{ margin: 0, fontSize: 12.5, color: '#7286a8' }}>{videos.data ? `${videos.data.total.toLocaleString('es-CL')} video${videos.data.total === 1 ? '' : 's'} con estos filtros` : 'Cargando…'}</p></div>
        <div className="vr-toggle" role="group" aria-label="Vista">
          <button type="button" className={modo === 'GRILLA' ? 'on' : ''} onClick={() => setModo('GRILLA')}><UiIcon name="dashboard" />Grilla</button>
          <button type="button" className={modo === 'TABLA' ? 'on' : ''} onClick={() => setModo('TABLA')}><UiIcon name="list" />Tabla</button>
        </div>
      </div>
      {/* Una sola fila: los filtros de uso diario a la vista; fechas y evaluación en "Más filtros". */}
      <div className="vr-filters">
        <label className="cpx-field vr-grow">Buscar<input value={q} maxLength={80} placeholder="Título, descripción o @captador" onChange={e => setQ(e.target.value)} /></label>
        <label className="cpx-field">Estado<select value={f.estado} onChange={e => cambiar('estado', e.target.value as VideoFiltros['estado'])}><option value="">Todos</option><option value="PUBLICADO">Publicados</option><option value="OCULTO">Vetados</option></select></label>
        <label className="cpx-field">Categoría<select value={f.categoria} onChange={e => cambiar('categoria', e.target.value as VideoFiltros['categoria'])}><option value="">Todas</option>{SOCIAL_CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label className="cpx-field">Captador<select value={f.captadorId ?? ''} onChange={e => cambiar('captadorId', e.target.value ? Number(e.target.value) : null)}><option value="">Todos</option>{captadores.map(c => <option key={c.id} value={c.id}>@{c.alias}</option>)}</select></label>
        <label className="cpx-field">Ordenar<select value={f.orden} onChange={e => cambiar('orden', e.target.value as VideoOrden)}>{ORDENES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        <MasFiltros activos={[f.desde, f.hasta, f.calificacionMax].filter(v => v !== '' && v !== null).length}>
          <label className="cpx-field">Subido desde<input type="date" value={f.desde} max={f.hasta || undefined} onChange={e => cambiar('desde', e.target.value)} /></label>
          <label className="cpx-field">Hasta<input type="date" value={f.hasta} min={f.desde || undefined} onChange={e => cambiar('hasta', e.target.value)} /></label>
          <label className="cpx-field">Evaluación<select value={f.calificacionMax ?? ''} onChange={e => cambiar('calificacionMax', e.target.value ? Number(e.target.value) : null)}><option value="">Todas</option><option value="2">★ 2 o menos</option><option value="3">★ 3 o menos</option></select></label>
        </MasFiltros>
        {filtrosActivos > 0 && <button type="button" className="cpx-btn vr-clear" onClick={limpiar} title="Quitar todos los filtros"><UiIcon name="close" />Limpiar ({filtrosActivos})</button>}
      </div>
      {aviso && <div className={`cpx-note${aviso.err ? ' vr-err' : ''}`} role="status" style={{ margin: '12px 0 0' }}>{aviso.text}</div>}
      {videos.isError && <div className="cpx-note vr-err" style={{ marginTop: 12 }}>{errorDe(videos.error, 'No se pudieron cargar los videos.')}</div>}

      <div style={{ marginTop: 14, opacity: videos.isFetching && !videos.isLoading ? 0.6 : 1, transition: 'opacity .2s' }}>
        {videos.isLoading ? <div className="cpx-empty">Cargando videos…</div>
          : !lista.length ? <div className="cpx-empty">No hay videos con estos filtros.</div>
            : modo === 'GRILLA'
              ? <div className="vr-grid">{lista.map(v => <VideoCard key={v.id} v={v} {...acciones} />)}</div>
              : <VideoTable items={lista} {...acciones} />}
      </div>

      {videos.data && videos.data.total > 0 && <div className="cpx-pager">
        <span className="vr-pagesize">
          Página {videos.data.pagina + 1} de {Math.max(1, videos.data.totalPaginas)}
          <label>Mostrar<select value={tamano} onChange={e => { setTamano(Number(e.target.value)); setPagina(0); }}>{[12, 24, 48].map(n => <option key={n} value={n}>{n}</option>)}</select>por página</label>
        </span>
        {videos.data.totalPaginas > 1 && <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="cpx-btn" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <button type="button" className="cpx-btn" disabled={pagina + 1 >= videos.data.totalPaginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
        </span>}
      </div>}
    </section>

    {detalle && <VideoDetail v={detalle} close={() => setDetalle(null)} {...acciones}
      onAviso={t => setAviso(t)} refrescar={() => refrescar()} />}
    {vetando && <VetoModal v={vetando} close={() => setVetando(null)} onDone={async actualizado => {
      setVetando(null);
      setAviso({ text: `"${actualizado.titulo}" quedó vetado: ya no aparece en el repositorio ni cuenta para el requisito semanal del captador.` });
      await refrescar({ ...actualizado } as VideoAdmin);
    }} />}
    {sancionando && <SancionModal v={sancionando} close={() => setSancionando(null)} onDone={async (s, vetado) => {
      setSancionando(null);
      setAviso({ text: `@${s.captadorAlias} quedó suspendido del repositorio hasta el ${fecha(s.hasta)}${vetado ? ' y el video fue vetado' : ''}.` });
      await refrescar(vetado ? { ...sancionando, estado: 'OCULTO', motivoOcultamiento: s.motivo, autorSuspendidoHasta: s.hasta } : { ...sancionando, autorSuspendidoHasta: s.hasta });
    }} />}
  </div>;
}

type Acciones = {
  ver: (v: VideoAdmin) => void; vetar: (v: VideoAdmin) => void; quitarVeto: (v: VideoAdmin) => void;
  sancionar: (v: VideoAdmin) => void; perfil: (id: number) => void;
};

/** Botón "Más filtros" con un panel desplegable; se cierra al hacer clic fuera o con Escape. */
function MasFiltros({ activos, children }: { activos: number; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); window.removeEventListener('keydown', esc); };
  }, [abierto]);
  return <div className="vr-more" ref={ref}>
    <button type="button" className={`cpx-btn vr-more-btn${activos ? ' on' : ''}`} aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
      <UiIcon name="filter" />Más filtros{activos > 0 && <em>{activos}</em>}
    </button>
    {abierto && <div className="vr-more-panel" role="dialog" aria-label="Más filtros">{children}</div>}
  </div>;
}

function Poster({ v, preview }: { v: VideoAdmin; preview?: boolean }) {
  const [hover, setHover] = useState(false);
  const filtro = { filter: socialFiltroCss(v.filtroVisual) };
  return <div className="vr-poster" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
    {preview && hover
      ? <video src={socialMediaUrl(v.url)} muted autoPlay loop playsInline preload="metadata" style={filtro} />
      : v.posterUrl ? <img src={socialMediaUrl(v.posterUrl)} alt="" loading="lazy" style={filtro} />
        : <video src={`${socialMediaUrl(v.url)}#t=0.5`} muted playsInline preload="metadata" style={filtro} />}
    <span className="vr-play"><UiIcon name="video" /></span>
    {v.duracionSeg != null && <span className="vr-dur">{duracion(v.duracionSeg)}</span>}
    {v.estado === 'OCULTO' && <span className="vr-veto">Vetado</span>}
  </div>;
}

function VideoCard({ v, ver, vetar, quitarVeto, sancionar, perfil }: { v: VideoAdmin } & Acciones) {
  return <article className={`vr-card${v.estado === 'OCULTO' ? ' vr-card-off' : ''}`}>
    <button type="button" className="vr-card-media" onClick={() => ver(v)} aria-label={`Ver ${v.titulo}`}><Poster v={v} preview /></button>
    <div className="vr-card-body">
      <strong className="cpx-clamp" title={v.titulo}>{v.titulo}</strong>
      <button type="button" className="vr-author" onClick={() => perfil(v.autorId)} title="Ver perfil del captador">
        <Avatar v={v} size={22} />@{v.autorAlias}
        {v.autorSuspendidoHasta && <span className="vr-tag vr-tag-red">Sancionado</span>}
      </button>
      <div className="vr-stats">
        <span><UiIcon name="download" />{v.descargasTotal.toLocaleString('es-CL')}</span>
        <span><UiIcon name="star" />{v.calificacionCount ? `${Number(v.calificacionPromedio).toFixed(1)} (${v.calificacionCount})` : '—'}</span>
        <span>{socialCategoriaLabel(v.categoria)}</span>
      </div>
      <small className="cpx-muted">Subido el {fecha(v.creadoEn)}</small>
      {v.estado === 'OCULTO' && v.motivoOcultamiento && <small className="vr-motivo cpx-clamp" title={v.motivoOcultamiento}>{v.motivoOcultamiento}</small>}
      <div className="vr-actions">
        <button type="button" className="cpx-btn" onClick={() => ver(v)}>Ver</button>
        {v.estado === 'PUBLICADO'
          ? <button type="button" className="cpx-btn cpx-btn-danger" onClick={() => vetar(v)}>Vetar</button>
          : <button type="button" className="cpx-btn" onClick={() => quitarVeto(v)}>Quitar veto</button>}
        <button type="button" className="cpx-btn cpx-btn-danger" onClick={() => sancionar(v)} title="Suspender al captador del repositorio">Sancionar</button>
      </div>
    </div>
  </article>;
}

function VideoTable({ items, ver, vetar, quitarVeto, sancionar, perfil }: { items: VideoAdmin[] } & Acciones) {
  return <div className="cpx-table-wrap">
    <table className="cpx-table cpx-table-wide cpx-fixed" style={{ minWidth: 980 }}>
      <colgroup><col style={{ width: '7%' }} /><col style={{ width: '22%' }} /><col style={{ width: '13%' }} /><col style={{ width: '10%' }} /><col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9%' }} /><col style={{ width: '8.5%' }} /><col style={{ width: '12.5%' }} /></colgroup>
      <thead><tr><th>Video</th><th>Título</th><th>Captador</th><th>Categoría</th><th className="cpx-num">Descargas</th><th>Evaluación</th><th>Subido</th><th>Estado</th><th /></tr></thead>
      <tbody>{items.map(v => <tr key={v.id}>
        <td><button type="button" className="vr-thumb-btn" onClick={() => ver(v)} aria-label={`Ver ${v.titulo}`}><Poster v={v} /></button></td>
        <td className="cpx-wrap"><strong className="cpx-clamp" title={v.titulo}>{v.titulo}</strong><div className="cpx-muted cpx-clamp" title={v.motivoOcultamiento ?? undefined}>{v.estado === 'OCULTO' && v.motivoOcultamiento ? v.motivoOcultamiento : `${duracion(v.duracionSeg)} · ${peso(v.tamanoBytes)}`}</div></td>
        <td><button type="button" className="vr-link" onClick={() => perfil(v.autorId)} title="Ver perfil del captador" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%' }}><Avatar v={v} size={24} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{v.autorAlias}</span></button>{v.autorSuspendidoHasta && <div className="vr-tag vr-tag-red" style={{ marginTop: 3 }}>Sancionado</div>}</td>
        <td>{socialCategoriaLabel(v.categoria)}</td>
        <td className="cpx-num">{v.descargasTotal.toLocaleString('es-CL')}</td>
        <td>{v.calificacionCount ? `★ ${Number(v.calificacionPromedio).toFixed(1)} (${v.calificacionCount})` : '—'}</td>
        <td>{fecha(v.creadoEn)}</td>
        <td><span className={`cpx-state cpx-state-${v.estado}`}>{v.estado === 'PUBLICADO' ? 'Publicado' : 'Vetado'}</span></td>
        <td><div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {v.estado === 'PUBLICADO'
            ? <button type="button" className="cpx-btn cpx-btn-danger" onClick={() => vetar(v)}>Vetar</button>
            : <button type="button" className="cpx-btn" onClick={() => quitarVeto(v)}>Quitar veto</button>}
          <button type="button" className="cpx-btn cpx-btn-danger" onClick={() => sancionar(v)} title="Suspender al captador del repositorio">Sancionar</button>
        </div></td>
      </tr>)}</tbody>
    </table>
  </div>;
}


function Avatar({ v, size }: { v: VideoAdmin; size: number }) {
  return <CapturerAvatar nombre={v.autorNombre || v.autorAlias} fotoPerfil={v.autorFoto} size={size} background="#1657d9" />;
}

function Overlay({ children, close, wide }: { children: ReactNode; close: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return <div className="vr-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div className={`vr-modal${wide ? ' vr-modal-wide' : ''}`} role="dialog" aria-modal="true">{children}</div>
  </div>;
}

function VideoDetail({ v, close, vetar, quitarVeto, sancionar, perfil, onAviso, refrescar }: { v: VideoAdmin; close: () => void; onAviso: (a: { text: string; err?: boolean }) => void; refrescar: () => Promise<void> } & Omit<Acciones, 'ver'>) {
  const sanciones = useQuery({ queryKey: ['trust-social-sanctions', v.autorId], queryFn: () => listSocialSanciones(v.autorId) });
  const [levantando, setLevantando] = useState<number | null>(null);

  async function levantar(s: SocialSancion) {
    if (!window.confirm(`¿Levantar la suspensión de @${s.captadorAlias}? Podrá volver a subir y descargar de inmediato.`)) return;
    setLevantando(s.id);
    try {
      await levantarSancionSocial(s.id);
      onAviso({ text: `Se levantó la suspensión de @${s.captadorAlias}.` });
      await refrescar();
    } catch (err) {
      onAviso({ text: errorDe(err, 'No se pudo levantar la sanción.'), err: true });
    } finally {
      setLevantando(null);
    }
  }

  return <Overlay close={close} wide>
    <header className="vr-modal-head">
      <div><h3 className="cpx-clamp">{v.titulo}</h3><span className={`cpx-state cpx-state-${v.estado}`}>{v.estado === 'PUBLICADO' ? 'Publicado' : 'Vetado'}</span></div>
      <button type="button" className="vr-x" onClick={close} aria-label="Cerrar"><UiIcon name="close" /></button>
    </header>
    <div className="vr-detail">
      <div className="vr-player">
        <video key={v.id} src={socialMediaUrl(v.url)} poster={v.posterUrl ? socialMediaUrl(v.posterUrl) : undefined} controls playsInline preload="metadata" style={{ filter: socialFiltroCss(v.filtroVisual) }} />
        <a className="cpx-btn" href={socialMediaUrl(v.url)} target="_blank" rel="noreferrer"><UiIcon name="eye" />Abrir archivo original</a>
      </div>
      <div className="vr-info">
        {v.estado === 'OCULTO' && <div className="cpx-note vr-err">
          <strong>Vetado{v.moderadoAt ? ` el ${fechaHora(v.moderadoAt)}` : ''}{v.moderadoPor ? ` por ${v.moderadoPor}` : ''}.</strong><br />Motivo: {v.motivoOcultamiento || '—'}
        </div>}
        {v.descripcion && <p className="vr-desc">{v.descripcion}</p>}
        <div className="vr-metrics">
          <div><small>Descargas</small><b>{v.descargasTotal.toLocaleString('es-CL')}</b></div>
          <div><small>Evaluación</small><b>{estrellas(v)}</b></div>
          <div><small>Duración</small><b>{duracion(v.duracionSeg)}</b></div>
          <div><small>Tamaño</small><b>{peso(v.tamanoBytes)}</b></div>
        </div>
        <dl className="vr-dl">
          <dt>Categoría</dt><dd>{socialCategoriaLabel(v.categoria)}</dd>
          <dt>Redes sugeridas</dt><dd>{v.redes.length ? v.redes.map(socialRedLabel).join(', ') : '—'}</dd>
          <dt>Formato</dt><dd>{v.contentType}</dd>
          <dt>Subido</dt><dd>{fechaHora(v.creadoEn)}</dd>
          <dt>Última edición</dt><dd>{fechaHora(v.actualizadoEn)}</dd>
          {v.estado === 'PUBLICADO' && v.moderadoAt && <><dt>Veto retirado</dt><dd>{fechaHora(v.moderadoAt)}{v.moderadoPor ? ` · ${v.moderadoPor}` : ''}</dd></>}
        </dl>

        <section className="vr-author-card">
          <Avatar v={v} size={42} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>{v.autorNombre || `@${v.autorAlias}`}</strong>
            <small>@{v.autorAlias} · Cuenta {v.autorActivo ? 'activa' : 'desactivada'}</small>
            {v.autorSuspendidoHasta && <span className="vr-tag vr-tag-red">Suspendido del repositorio hasta el {fecha(v.autorSuspendidoHasta)}</span>}
          </div>
          <button type="button" className="cpx-btn" onClick={() => perfil(v.autorId)}><UiIcon name="user" />Ver perfil</button>
        </section>

        <section>
          <h4 className="vr-h4">Sanciones del captador</h4>
          {sanciones.isLoading ? <div className="cpx-muted">Cargando…</div>
            : sanciones.data?.length ? <ul className="vr-sanctions">{sanciones.data.map(s => <li key={s.id} className={s.vigente ? 'on' : ''}>
              <div>
                <strong>{s.dias} día{s.dias === 1 ? '' : 's'} · {fecha(s.desde)} → {fecha(s.hasta)}</strong>
                <small>{s.motivo}{s.contenidoTitulo ? ` · Video: "${s.contenidoTitulo}"` : ''}</small>
                <small>{s.creadoPor ? `Por ${s.creadoPor}` : ''}{s.levantadaEn ? ` · Levantada el ${fecha(s.levantadaEn)}${s.levantadaPor ? ` por ${s.levantadaPor}` : ''}` : s.vigente ? ' · Vigente' : ' · Cumplida'}</small>
              </div>
              {s.vigente && <button type="button" className="cpx-btn" disabled={levantando === s.id} onClick={() => void levantar(s)}>{levantando === s.id ? 'Levantando…' : 'Levantar'}</button>}
            </li>)}</ul> : <div className="cpx-muted" style={{ fontSize: 12.5 }}>Sin sanciones.</div>}
        </section>
      </div>
    </div>
    <footer className="vr-modal-foot">
      {v.estado === 'PUBLICADO'
        ? <button type="button" className="cpx-btn cpx-btn-danger" onClick={() => vetar(v)}><UiIcon name="shieldX" />Vetar video</button>
        : <button type="button" className="cpx-btn" onClick={() => quitarVeto(v)}><UiIcon name="shieldCheck" />Quitar veto</button>}
      <button type="button" className="cpx-btn vr-btn-solid-danger" onClick={() => sancionar(v)}><UiIcon name="lock" />Sancionar captador</button>
    </footer>
  </Overlay>;
}

function MotivoFields({ preset, setPreset, detalle, setDetalle }: { preset: string; setPreset: (s: string) => void; detalle: string; setDetalle: (s: string) => void }) {
  return <>
    <label className="cpx-field">Motivo<select value={preset} onChange={e => setPreset(e.target.value)}>{MOTIVOS.map(m => <option key={m}>{m}</option>)}</select></label>
    <label className="cpx-field">{preset === 'Otro' ? 'Describe el motivo' : 'Detalle (opcional)'}
      <textarea value={detalle} maxLength={240} rows={3} placeholder="Lo verá el captador" onChange={e => setDetalle(e.target.value)} />
    </label>
  </>;
}

function VetoModal({ v, close, onDone }: { v: VideoAdmin; close: () => void; onDone: (actualizado: VideoAdmin) => Promise<void> }) {
  const [preset, setPreset] = useState<string>(MOTIVO_INICIAL);
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const motivo = armarMotivo(preset, detalle);

  async function enviar() {
    if (motivo.length < 5) { setError('Describe el motivo (al menos 5 caracteres).'); return; }
    setEnviando(true); setError('');
    try {
      const r = await setSocialVisibilidad(v.id, 'OCULTAR', motivo);
      await onDone({ ...v, estado: 'OCULTO', motivoOcultamiento: r.motivoOcultamiento, moderadoAt: new Date().toISOString() });
    } catch (err) {
      setError(errorDe(err, 'No se pudo vetar el video.'));
      setEnviando(false);
    }
  }

  return <Overlay close={close}>
    <header className="vr-modal-head"><div><h3>Vetar video</h3></div><button type="button" className="vr-x" onClick={close} aria-label="Cerrar"><UiIcon name="close" /></button></header>
    <div className="vr-form">
      <div className="vr-mini"><Poster v={v} /><div><strong className="cpx-clamp">{v.titulo}</strong><small style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Avatar v={v} size={18} />@{v.autorAlias} · {fecha(v.creadoEn)}</small></div></div>
      <p className="vr-hint">El video sale del repositorio, deja de contar para el requisito de 3 videos semanales y el captador verá el motivo en "Mis contenidos". Puedes quitar el veto después.</p>
      <MotivoFields preset={preset} setPreset={setPreset} detalle={detalle} setDetalle={setDetalle} />
      {error && <div className="cpx-note vr-err">{error}</div>}
    </div>
    <footer className="vr-modal-foot">
      <button type="button" className="cpx-btn" onClick={close}>Cancelar</button>
      <button type="button" className="cpx-btn vr-btn-solid-danger" disabled={enviando} onClick={() => void enviar()}>{enviando ? 'Vetando…' : 'Vetar video'}</button>
    </footer>
  </Overlay>;
}

function SancionModal({ v, close, onDone }: { v: VideoAdmin; close: () => void; onDone: (s: SocialSancion, vetado: boolean) => Promise<void> }) {
  const [dias, setDias] = useState(7);
  const [preset, setPreset] = useState<string>(MOTIVO_INICIAL);
  const [detalle, setDetalle] = useState('');
  const [vetarVideo, setVetarVideo] = useState(v.estado === 'PUBLICADO');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const motivo = armarMotivo(preset, detalle);
  const hasta = new Date(Date.now() + dias * 86_400_000);

  async function enviar() {
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) { setError('La suspensión debe durar entre 1 y 365 días.'); return; }
    if (motivo.length < 5) { setError('Describe el motivo (al menos 5 caracteres).'); return; }
    setEnviando(true); setError('');
    try {
      const s = await sancionarCaptadorSocial(v.autorId, { dias, motivo, contenidoId: v.id, vetarVideo });
      await onDone(s, vetarVideo && v.estado === 'PUBLICADO');
    } catch (err) {
      setError(errorDe(err, 'No se pudo aplicar la sanción.'));
      setEnviando(false);
    }
  }

  return <Overlay close={close}>
    <header className="vr-modal-head"><div><h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar v={v} size={32} />Sancionar a @{v.autorAlias}</h3></div><button type="button" className="vr-x" onClick={close} aria-label="Cerrar"><UiIcon name="close" /></button></header>
    <div className="vr-form">
      <div className="vr-mini"><Poster v={v} /><div><strong className="cpx-clamp">{v.titulo}</strong><small>Video que motiva la sanción</small></div></div>
      <p className="vr-hint">Suspende al captador del repositorio de Redes sociales: mientras dure no puede subir videos ni descargar contenido de otros. Su cuenta, comisiones y captaciones siguen igual.</p>
      {v.autorSuspendidoHasta && <div className="cpx-note">Ya tiene una suspensión vigente hasta el {fecha(v.autorSuspendidoHasta)}. Rige la que termine más tarde.</div>}
      <div className="cpx-field">Duración
        <div className="vr-chips">
          {DURACIONES.map(d => <button type="button" key={d} className={dias === d ? 'on' : ''} onClick={() => setDias(d)}>{d} días</button>)}
          <input type="number" min={1} max={365} value={dias} aria-label="Días de suspensión" onChange={e => setDias(Math.trunc(Number(e.target.value)))} />
        </div>
        <small className="cpx-muted" style={{ fontWeight: 600 }}>Hasta el {hasta.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</small>
      </div>
      <MotivoFields preset={preset} setPreset={setPreset} detalle={detalle} setDetalle={setDetalle} />
      {v.estado === 'PUBLICADO' && <label className="vr-check"><input type="checkbox" checked={vetarVideo} onChange={e => setVetarVideo(e.target.checked)} />Vetar también este video</label>}
      {error && <div className="cpx-note vr-err">{error}</div>}
    </div>
    <footer className="vr-modal-foot">
      <button type="button" className="cpx-btn" onClick={close}>Cancelar</button>
      <button type="button" className="cpx-btn vr-btn-solid-danger" disabled={enviando} onClick={() => void enviar()}>{enviando ? 'Aplicando…' : `Suspender ${dias} día${dias === 1 ? '' : 's'}`}</button>
    </footer>
  </Overlay>;
}

const css = `
.vr-err{background:#fde8e8;color:#b42318}
.vr-kpis{grid-template-columns:repeat(6,minmax(160px,1fr));overflow-x:auto;padding-bottom:2px;scrollbar-width:thin}
.vr-kpis .cpx-kpi{padding:13px 12px;gap:9px}
.vr-kpis .cpx-ico{width:34px;height:34px;border-radius:10px}
.vr-kpis .cpx-kpi-value{font-size:22px}
.vr-filters{display:flex;flex-wrap:nowrap;gap:10px;align-items:flex-end}
.vr-filters>.cpx-field{flex:1 1 130px;min-width:0}
.vr-filters>.vr-grow{flex:2.2 1 220px}
.vr-filters .cpx-field input,.vr-filters .cpx-field select{width:100%;min-width:0;box-sizing:border-box;height:38px}
.vr-clear,.vr-more-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:38px;flex:0 0 auto}
.vr-clear svg,.vr-more-btn svg{width:14px;height:14px}
.vr-more{position:relative;flex:0 0 auto}
.vr-more-btn.on{border-color:#1657d9;background:#eef4ff}
.vr-more-btn em{display:grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:#1657d9;color:#fff;font-style:normal;font-size:11px;font-weight:850}
.vr-more-panel{position:absolute;right:0;top:calc(100% + 6px);z-index:20;display:grid;gap:10px;width:250px;padding:14px;background:#fff;border:1px solid #e6edf7;border-radius:14px;box-shadow:0 16px 36px rgba(15,44,92,.16)}
.vr-more-panel .cpx-field input,.vr-more-panel .cpx-field select{width:100%;box-sizing:border-box}
.vr-pagesize{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.vr-pagesize label{display:inline-flex;align-items:center;gap:6px}
.vr-pagesize select{padding:5px 8px;border:1px solid #d7e0ee;border-radius:8px;font:inherit;font-size:12.5px;color:#0b2559;background:#fff}
.vr-toggle{display:flex;gap:4px;padding:4px;border:1px solid #d9e3f3;border-radius:11px;background:#f7f9fd}
.vr-toggle button{display:flex;align-items:center;gap:6px;padding:7px 11px;border:0;border-radius:8px;background:transparent;font:inherit;font-size:12.5px;font-weight:750;color:#52678f;cursor:pointer}
.vr-toggle button svg{width:15px;height:15px}
.vr-toggle button.on{background:#fff;color:#1657d9;box-shadow:0 2px 6px rgba(15,44,92,.1)}
.vr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.vr-card{display:flex;flex-direction:column;border:1px solid #e6edf7;border-radius:14px;overflow:hidden;background:#fff;min-width:0;transition:box-shadow .2s}
.vr-card:hover{box-shadow:0 10px 24px rgba(15,44,92,.1)}
.vr-card-off .vr-poster>img,.vr-card-off .vr-poster>video{opacity:.45}
.vr-card-media{display:block;padding:0;border:0;background:none;cursor:pointer;width:100%}
.vr-poster{position:relative;aspect-ratio:9/12;background:#0b1730;overflow:hidden}
.vr-poster>img,.vr-poster>video{width:100%;height:100%;object-fit:cover;display:block}
.vr-play{position:absolute;left:8px;top:8px;display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:rgba(3,22,58,.55);color:#fff}
.vr-play svg{width:15px;height:15px}
.vr-dur{position:absolute;right:8px;bottom:8px;padding:2px 7px;border-radius:6px;background:rgba(3,22,58,.72);color:#fff;font-size:11px;font-weight:800}
.vr-veto{position:absolute;right:8px;top:8px;padding:3px 8px;border-radius:7px;background:#b42318;color:#fff;font-size:11px;font-weight:850;letter-spacing:.02em}
.vr-card-body{display:grid;gap:6px;padding:11px 12px 12px;min-width:0}
.vr-card-body>strong{color:#0b2559;font-size:13.5px;line-height:1.3;min-height:2.6em}
.vr-author{display:flex;align-items:center;gap:6px;padding:0;border:0;background:none;font:inherit;font-size:12.5px;font-weight:700;color:#1657d9;cursor:pointer;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}
.vr-author:hover{text-decoration:underline}
.vr-avatar{display:inline-grid;place-items:center;flex:0 0 auto;border-radius:50%;background:#e6efff;color:#1657d9;font-weight:850;overflow:hidden}
.vr-avatar img{width:100%;height:100%;object-fit:cover}
.vr-stats{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:#42557d}
.vr-stats span{display:inline-flex;align-items:center;gap:4px}
.vr-stats svg{width:13px;height:13px}
.vr-motivo{color:#b42318;font-size:11.5px}
.vr-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:2px}
.vr-actions .cpx-btn{padding:6px 9px;font-size:12px}
.vr-tag{display:inline-block;padding:2px 7px;border-radius:6px;font-size:10.5px;font-weight:800;white-space:nowrap}
.vr-tag-red{background:#fde8e8;color:#b42318}
.vr-link{padding:0;border:0;background:none;font:inherit;font-weight:700;color:#1657d9;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vr-link:hover{text-decoration:underline}
.vr-thumb-btn{padding:0;border:0;background:none;cursor:pointer}
.vr-thumb-btn .vr-poster{width:46px;height:58px;aspect-ratio:auto;border-radius:9px}
.vr-thumb-btn .vr-play,.vr-thumb-btn .vr-dur,.vr-thumb-btn .vr-veto{display:none}
.vr-overlay{position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:20px;background:rgba(3,22,58,.55);backdrop-filter:blur(2px)}
.vr-modal{display:flex;flex-direction:column;width:min(520px,100%);max-height:calc(100vh - 40px);background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(3,22,58,.3);overflow:hidden}
.vr-modal-wide{width:min(980px,100%)}
.vr-modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #eef3fa}
.vr-modal-head>div{display:flex;align-items:center;gap:10px;min-width:0}
.vr-modal-head h3{margin:0;font-size:16px;font-weight:850;color:#0b2559}
.vr-x{display:grid;place-items:center;width:34px;height:34px;flex:0 0 auto;border:0;border-radius:10px;background:#f1f5fb;color:#42557d;cursor:pointer}
.vr-x svg{width:17px;height:17px}
.vr-modal-foot{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;padding:14px 20px;border-top:1px solid #eef3fa;background:#fbfcff}
.vr-modal-foot .cpx-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 14px}
.vr-modal-foot svg{width:15px;height:15px}
.vr-btn-solid-danger{background:#b42318;border-color:#b42318;color:#fff}
.vr-btn-solid-danger:hover{background:#951b12}
.vr-btn-solid-danger:disabled{opacity:.6;cursor:default}
.vr-detail{display:grid;grid-template-columns:minmax(240px,340px) minmax(0,1fr);gap:20px;padding:18px 20px;overflow:auto}
.vr-player{display:grid;gap:10px;align-content:start}
.vr-player video{width:100%;max-height:62vh;border-radius:14px;background:#0b1730}
.vr-player .cpx-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none}
.vr-player .cpx-btn svg{width:15px;height:15px}
.vr-info{display:grid;gap:14px;align-content:start;min-width:0}
.vr-desc{margin:0;font-size:13px;line-height:1.5;color:#31456e;white-space:pre-wrap}
.vr-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.vr-metrics>div{padding:10px;border-radius:12px;background:#f5f8fd;min-width:0}
.vr-metrics small{display:block;font-size:11px;font-weight:700;color:#7286a8}
.vr-metrics b{display:block;margin-top:2px;font-size:14px;color:#0b2559;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vr-dl{display:grid;grid-template-columns:130px minmax(0,1fr);gap:6px 12px;margin:0;font-size:12.5px}
.vr-dl dt{color:#7286a8;font-weight:700}
.vr-dl dd{margin:0;color:#0b2559;overflow-wrap:anywhere}
.vr-author-card{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #e6edf7;border-radius:14px}
.vr-author-card strong{display:block;color:#0b2559;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vr-author-card small{display:block;margin:2px 0 4px;color:#7286a8;font-size:12px}
.vr-author-card .cpx-btn{display:inline-flex;align-items:center;gap:6px}
.vr-author-card .cpx-btn svg{width:14px;height:14px}
.vr-h4{margin:0 0 8px;font-size:13px;font-weight:850;color:#0b2559}
.vr-sanctions{display:grid;gap:6px;margin:0;padding:0;list-style:none}
.vr-sanctions li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;border-radius:11px;background:#f7f9fd;font-size:12.5px}
.vr-sanctions li.on{background:#fff4f3;border:1px solid #f3c9c5}
.vr-sanctions strong{display:block;color:#0b2559}
.vr-sanctions small{display:block;margin-top:2px;color:#7286a8}
.vr-form{display:grid;gap:12px;padding:16px 20px;overflow:auto}
.vr-form textarea{padding:9px 11px;border:1px solid #d7e0ee;border-radius:10px;font:inherit;font-size:13px;color:#0b2559;resize:vertical}
.vr-mini{display:flex;align-items:center;gap:12px;min-width:0}
.vr-mini .vr-poster{width:54px;height:68px;flex:0 0 auto;aspect-ratio:auto;border-radius:10px}
.vr-mini .vr-play,.vr-mini .vr-dur,.vr-mini .vr-veto{display:none}
.vr-mini strong{color:#0b2559;font-size:13.5px}
.vr-mini small{display:block;margin-top:2px;color:#7286a8;font-size:12px}
.vr-hint{margin:0;font-size:12.5px;line-height:1.45;color:#42557d}
.vr-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.vr-chips button{padding:7px 11px;border:1px solid #d9e3f3;border-radius:9px;background:#fff;font:inherit;font-size:12.5px;font-weight:750;color:#42557d;cursor:pointer}
.vr-chips button.on{border-color:#b42318;background:#fde8e8;color:#b42318}
.vr-chips input{width:74px}
.vr-check{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#31456e}
@media (max-width:780px){.vr-detail{grid-template-columns:1fr}.vr-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.vr-filters{flex-wrap:wrap}.vr-filters>.vr-grow{flex-basis:100%}}
@media (max-width:620px){.vr-overlay{padding:0}.vr-modal{max-height:100vh;border-radius:0}.vr-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.vr-dl{grid-template-columns:110px minmax(0,1fr)}}
`;
