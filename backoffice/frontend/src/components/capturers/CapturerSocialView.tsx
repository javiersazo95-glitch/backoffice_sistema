import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSocialMetricas, getVideoMetricas, listSocialAdmin, setSocialVisibilidad, socialMediaUrl } from '@/api/capturerSocial';
import type { SocialContenidoAdmin, SocialNivelCodigo } from '@/types/capturerSocial';
import { socialCategoriaLabel, socialFiltroCss } from '@/types/capturerSocial';
import type { CapturerProfile } from '@/types/capturer';
import { BarRow, Kpi, NIVEL_META, cpxCss, pct } from './capturerMetricsUi';
import CapturerAvatar from './CapturerAvatar';

const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-CL')} ${n === 1 ? uno : varios}`;

/** Captador con su foto: los rankings del repositorio solo traen id y alias, la foto sale de la lista. */
function Persona({ alias, foto, size = 22 }: { alias: string; foto?: string | null; size?: number }) {
  return <span className="cpx-person-label"><CapturerAvatar nombre={alias} fotoPerfil={foto} size={size} /><span>@{alias}</span></span>;
}

/** Métricas y moderación del repositorio "Redes sociales" de los captadores. */
export default function CapturerSocialView({ all = [] }: { all?: CapturerProfile[] }) {
  const fotoPorId = new Map(all.map(c => [c.id, c.fotoPerfil]));
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(0);
  const [aviso, setAviso] = useState('');
  const metricas = useQuery({ queryKey: ['trust-capturers-social-metrics', periodo], queryFn: () => getSocialMetricas(periodo) });
  const contenidos = useQuery({
    queryKey: ['trust-capturers-social-contents', estado, tipo, q, pagina],
    queryFn: () => listSocialAdmin({ estado, tipo, q, pagina, tamano: 10 }),
  });
  // Destacados del repositorio de videos (histórico): los mismos datos que usa la pestaña Repositorio videos.
  const videos = useQuery({ queryKey: ['trust-videos-metrics', 'destacados'], queryFn: () => getVideoMetricas() });
  const m = metricas.data;
  const v = videos.data;
  const catTop = v?.porCategoria[0];
  const totalCat = (v?.porCategoria ?? []).reduce((n, c) => n + c.cantidad, 0);
  const capTop = v?.topCaptadores[0];
  const masDesc = v?.masDescargados[0];
  const peor = v?.peorEvaluados[0];
  const sinDatos = videos.isLoading ? '…' : '—';
  const niveles = (Object.keys(NIVEL_META) as SocialNivelCodigo[]);
  const maxNivel = Math.max(1, ...niveles.map(n => m?.captadoresPorNivel?.[n] ?? 0));
  const maxAporte = Math.max(1, ...(m?.topAportadores ?? []).map(r => r.cantidad));
  const maxDescarga = Math.max(1, ...(m?.topDescargadores ?? []).map(r => r.cantidad));

  async function moderar(c: SocialContenidoAdmin) {
    setAviso('');
    try {
      if (c.estado === 'PUBLICADO') {
        const motivo = window.prompt(`Motivo para ocultar "${c.titulo}" (lo verá el captador):`)?.trim();
        if (!motivo) return;
        await setSocialVisibilidad(c.id, 'OCULTAR', motivo.slice(0, 300));
        setAviso('Contenido oculto: ya no aparece en el repositorio ni cuenta para el requisito semanal.');
      } else {
        await setSocialVisibilidad(c.id, 'RESTAURAR');
        setAviso('Contenido restaurado en el repositorio.');
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['trust-capturers-social-contents'] }),
        qc.invalidateQueries({ queryKey: ['trust-capturers-social-metrics'] }),
        qc.invalidateQueries({ queryKey: ['trust-videos-metrics'] }),
        qc.invalidateQueries({ queryKey: ['trust-videos'] }),
      ]);
    } catch (err) {
      setAviso((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'No se pudo cambiar la visibilidad.');
    }
  }

  return <div className="cpx">
    <style>{cpxCss}</style>
    <div className="cpx-head">
      <div><h2>Redes sociales</h2><p>Repositorio compartido de contenido que suben los captadores para publicar en sus redes.</p></div>
      <label className="cpx-field">Periodo<input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} /></label>
    </div>

    <section className="cpx-kpis">
      <Kpi icon="upload" tone="blue" label="Contenido publicado" value={m ? m.contenidosPublicados.toLocaleString('es-CL') : '—'} foot={m ? `${plural(m.videosPublicados, 'video', 'videos')} · ${plural(m.imagenesPublicadas, 'imagen', 'imágenes')}` : '—'} />
      <Kpi icon="calendar" tone="violet" label="Subidas esta semana" value={m ? String(m.subidasSemana) : '—'} foot={m ? `${m.subidasPeriodo} en ${m.periodo}` : '—'} />
      <Kpi icon="download" tone="green" label="Descargas de la semana" value={m ? String(m.descargasSemana) : '—'} foot={m ? `${m.descargasPeriodo} en ${m.periodo}` : '—'} />
      <Kpi icon="shieldCheck" tone="amber" label="Con acceso activo" value={m ? String(m.captadoresConAcceso) : '—'} foot={m ? `${pct(m.captadoresConAcceso, m.captadoresAprobados)} de los aprobados` : '—'} />
      <Kpi icon="shieldX" tone="red" label="Contenido oculto" value={m ? String(m.contenidosOcultos) : '—'} foot="Por moderación" />
    </section>

    <section className="cpx-kpis cpx-kpis-text" aria-label="Destacados de videos">
      <Kpi icon="dashboard" tone="blue" label="Categoría con más videos" value={catTop ? socialCategoriaLabel(catTop.categoria) : sinDatos}
        foot={catTop ? `${plural(catTop.cantidad, 'video', 'videos')} · ${pct(catTop.cantidad, totalCat)} del total` : 'Sin videos publicados'}
        title={v?.porCategoria.map(c => `${socialCategoriaLabel(c.categoria)}: ${c.cantidad}`).join(' · ')} />
      <Kpi icon="crown" tone="violet" label="Captador con más videos" value={capTop ? `@${capTop.alias}` : sinDatos}
        foot={capTop ? `${plural(capTop.cantidad, 'video publicado', 'videos publicados')}` : 'Sin videos publicados'}
        title={v?.topCaptadores.map((r, i) => `${i + 1}. @${r.alias} (${r.cantidad})`).join(' · ')} />
      <Kpi icon="download" tone="green" label="Video más descargado" value={masDesc ? masDesc.titulo : sinDatos}
        foot={masDesc ? `@${masDesc.autorAlias} · ${plural(masDesc.descargasTotal, 'descarga', 'descargas')}` : 'Sin descargas todavía'}
        title={v?.masDescargados.map((x, i) => `${i + 1}. ${x.titulo} (${x.descargasTotal})`).join(' · ')} />
      <Kpi icon="trendDown" tone="red" label="Video peor evaluado" value={peor ? peor.titulo : sinDatos}
        foot={peor ? `★ ${Number(peor.calificacionPromedio).toFixed(1)} (${peor.calificacionCount}) · @${peor.autorAlias}` : 'Sin reseñas todavía'}
        title={v?.peorEvaluados.map((x, i) => `${i + 1}. ${x.titulo} (★ ${Number(x.calificacionPromedio).toFixed(1)})`).join(' · ')} />
    </section>

    <div className="cpx-grid2">
      <section className="cpx-card">
        <h3>Captadores por medalla</h3>
        <p>Nivel según puntos por compradores captados; define cuántas piezas descargan por semana.</p>
        {niveles.map(n => <BarRow key={n} label={<><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: NIVEL_META[n].color, marginRight: 6 }} />{NIVEL_META[n].label}</>}
          value={m?.captadoresPorNivel?.[n] ?? 0} max={maxNivel} color={NIVEL_META[n].color} />)}
      </section>
      <section className="cpx-card">
        <h3>Más activos del periodo</h3>
        <p>Quién alimenta el repositorio y quién más lo usa.</p>
        <strong style={{ fontSize: 12, color: '#42557d' }}>Aportes (subidas)</strong>
        {m?.topAportadores.length ? m.topAportadores.map(r => <BarRow key={`a${r.captadorId}`} label={<Persona alias={r.alias} foto={fotoPorId.get(r.captadorId)} />} value={r.cantidad} max={maxAporte} color="#6d3fd6" />) : <div className="cpx-empty">Sin subidas.</div>}
        <strong style={{ fontSize: 12, color: '#42557d', display: 'block', marginTop: 8 }}>Descargas</strong>
        {m?.topDescargadores.length ? m.topDescargadores.map(r => <BarRow key={`d${r.captadorId}`} label={<Persona alias={r.alias} foto={fotoPorId.get(r.captadorId)} />} value={r.cantidad} max={maxDescarga} color="#0f8a4d" />) : <div className="cpx-empty">Sin descargas.</div>}
      </section>
    </div>

    <div className="cpx-grid2">
      <TopList fotoPorId={fotoPorId} title="Más descargados" items={m?.masDescargados ?? []} metric={c => plural(c.descargasTotal, 'descarga', 'descargas')} />
      <TopList fotoPorId={fotoPorId} title="Mejor evaluados" items={m?.mejorEvaluados ?? []} metric={c => `★ ${Number(c.calificacionPromedio).toFixed(1)} (${c.calificacionCount})`} />
    </div>

    <section className="cpx-card">
      <div className="cpx-head" style={{ marginBottom: 10 }}>
        <div><h3>Moderación de contenido</h3><p style={{ margin: 0, fontSize: 12.5, color: '#7286a8' }}>Oculta piezas que no cumplan las normas; el captador ve el motivo.</p></div>
        <div className="cpx-filters">
          <label className="cpx-field">Buscar<input value={q} maxLength={80} placeholder="Título o @captador" onChange={e => { setQ(e.target.value); setPagina(0); }} /></label>
          <label className="cpx-field">Estado<select value={estado} onChange={e => { setEstado(e.target.value); setPagina(0); }}><option value="">Publicado y oculto</option><option value="PUBLICADO">Publicado</option><option value="OCULTO">Oculto</option></select></label>
          <label className="cpx-field">Tipo<select value={tipo} onChange={e => { setTipo(e.target.value); setPagina(0); }}><option value="">Todos</option><option value="VIDEO">Videos</option><option value="IMAGEN">Imágenes</option></select></label>
        </div>
      </div>
      {aviso && <div className="cpx-note" role="status" style={{ marginBottom: 10 }}>{aviso}</div>}
      <div className="cpx-table-wrap">
        <table className="cpx-table cpx-table-wide cpx-fixed">
          <colgroup><col style={{ width: '7%' }} /><col style={{ width: '20.5%' }} /><col style={{ width: '12%' }} /><col style={{ width: '11.5%' }} /><col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9.25%' }} /><col style={{ width: '8.75%' }} /></colgroup>
          <thead><tr><th>Pieza</th><th>Título</th><th>Captador</th><th>Categoría</th><th className="cpx-num">Descargas</th><th>Evaluación</th><th>Subido</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {contenidos.isLoading ? <tr><td colSpan={9} className="cpx-empty">Cargando…</td></tr>
              : contenidos.data?.contenido.length ? contenidos.data.contenido.map(c => <tr key={c.id}>
                <td><a href={socialMediaUrl(c.url)} target="_blank" rel="noreferrer">{c.tipo === 'VIDEO'
                  ? (c.posterUrl ? <img className="cpx-thumb" src={socialMediaUrl(c.posterUrl)} alt="" style={{ filter: socialFiltroCss(c.filtroVisual) }} /> : <span className="cpx-thumb" style={{ display: 'grid', placeItems: 'center', color: '#fff' }}>▶</span>)
                  : <img className="cpx-thumb" src={socialMediaUrl(c.url)} alt="" style={{ filter: socialFiltroCss(c.filtroVisual) }} />}</a></td>
                <td className="cpx-wrap"><strong className="cpx-clamp" title={c.titulo}>{c.titulo}</strong><div className="cpx-muted cpx-clamp">{c.tipo === 'VIDEO' ? 'Video' : 'Imagen'}{c.motivoOcultamiento ? ` · ${c.motivoOcultamiento}` : ''}</div></td>
                <td title={`@${c.autorAlias}`}><Persona alias={c.autorAlias} foto={fotoPorId.get(c.autorId)} size={24} /></td>
                <td>{socialCategoriaLabel(c.categoria)}</td>
                <td className="cpx-num">{c.descargasTotal}</td>
                <td>{c.calificacionCount ? `★ ${Number(c.calificacionPromedio).toFixed(1)} (${c.calificacionCount})` : '—'}</td>
                <td>{new Date(c.creadoEn).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                <td><span className={`cpx-state cpx-state-${c.estado}`}>{c.estado === 'PUBLICADO' ? 'Publicado' : 'Oculto'}</span></td>
                <td><button type="button" className={`cpx-btn${c.estado === 'PUBLICADO' ? ' cpx-btn-danger' : ''}`} onClick={() => void moderar(c)}>{c.estado === 'PUBLICADO' ? 'Ocultar' : 'Restaurar'}</button></td>
              </tr>) : <tr><td colSpan={9} className="cpx-empty">No hay contenido con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      {contenidos.data && contenidos.data.totalPaginas > 1 && <div className="cpx-pager">
        <span>{contenidos.data.total} piezas · página {contenidos.data.pagina + 1} de {contenidos.data.totalPaginas}</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="cpx-btn" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <button type="button" className="cpx-btn" disabled={pagina + 1 >= contenidos.data.totalPaginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
        </span>
      </div>}
    </section>
  </div>;
}

function TopList({ title, items, metric, fotoPorId }: { title: string; items: SocialContenidoAdmin[]; metric: (c: SocialContenidoAdmin) => string; fotoPorId: Map<number, string | null | undefined> }) {
  return <section className="cpx-card">
    <h3>{title}</h3>
    <div className="cpx-rank" style={{ marginTop: 10 }}>
      {items.length ? items.map((c, i) => <div className="cpx-rank-row" key={c.id}>
        <em>{i + 1}</em>
        <div><strong title={c.titulo}>{c.titulo}</strong><small><Persona alias={c.autorAlias} foto={fotoPorId.get(c.autorId)} size={16} /></small></div>
        <b>{metric(c)}</b>
      </div>) : <div className="cpx-empty">Sin datos todavía.</div>}
    </div>
  </section>;
}
