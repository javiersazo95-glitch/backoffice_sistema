import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { editSocialContenido, listSocialResenas, saveSocialResena, socialMediaUrl } from '@/api/capturerSocial';
import type { SocialCategoria, SocialContenido, SocialFiltro, SocialRed } from '@/types/capturerSocial';
import { SOCIAL_CATEGORIAS, SOCIAL_FILTROS, SOCIAL_REDES, socialCategoriaLabel, socialFiltroCss, socialRedLabel } from '@/types/capturerSocial';
import { Avatar, Stars, downloadState } from './SocialPostCard';
import { fechaCorta, formatBytes, tiempoRestante } from './media';

type Props = { c: SocialContenido; now: number; downloading: boolean; onClose: () => void; onDownload: (c: SocialContenido) => void; onChanged: () => void };

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
}

export default function SocialDetailModal({ c, now, downloading, onClose, onDownload, onChanged }: Props) {
  const qc = useQueryClient();
  const resenas = useQuery({ queryKey: ['capturer-social-resenas', c.id], queryFn: () => listSocialResenas(c.id) });
  const propia = resenas.data?.find(r => r.propia);
  const [estrellas, setEstrellas] = useState(c.miCalificacion ?? 0);
  const [texto, setTexto] = useState('');
  const [red, setRed] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (propia) { setEstrellas(propia.estrellas); setTexto(propia.resena ?? ''); setRed(propia.redSocial ?? ''); } }, [propia]);
  const dl = downloadState(c, now);
  const puedeEvaluar = !c.propio && !!c.ultimaDescarga;

  async function guardar() {
    if (!estrellas) { setMsg('Elige de 1 a 5 estrellas.'); return; }
    setSaving(true); setMsg('');
    try {
      await saveSocialResena(c.id, { estrellas, resena: texto.trim() || undefined, redSocial: red || undefined });
      await qc.invalidateQueries({ queryKey: ['capturer-social-resenas', c.id] });
      onChanged();
      setMsg('¡Gracias! Tu evaluación ayuda al resto de captadores.');
    } catch (err) { setMsg(errorMessage(err, 'No pudimos guardar tu evaluación.')); }
    finally { setSaving(false); }
  }

  return <div className="cap-soc-overlay" role="dialog" aria-modal="true" aria-labelledby="cap-soc-detail-title" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="cap-soc-modal">
      <div className="cap-soc-modal-head">
        <h3 id="cap-soc-detail-title">{c.titulo}</h3>
        <button type="button" className="cap-soc-x" aria-label="Cerrar" onClick={onClose}>×</button>
      </div>
      <div className="cap-soc-modal-body cap-soc-split">
        <div className="cap-soc-preview">
          {c.tipo === 'VIDEO'
            ? <video src={socialMediaUrl(c.url)} poster={c.posterUrl ? socialMediaUrl(c.posterUrl) : undefined} controls controlsList="nodownload" disablePictureInPicture onContextMenu={e => e.preventDefault()} autoPlay muted playsInline style={{ filter: socialFiltroCss(c.filtroVisual) }} />
            : <img src={socialMediaUrl(c.url)} alt={c.titulo} style={{ filter: socialFiltroCss(c.filtroVisual) }} />}
          <span className="cap-soc-author"><Avatar alias={c.autorAlias} foto={c.autorFoto} /><span>@{c.autorAlias}</span></span>
        </div>
        <div className="cap-soc-form">
          <div className="cap-soc-tags">
            <span className="cap-soc-tag cap-soc-tag-cat">{socialCategoriaLabel(c.categoria)}</span>
            {c.redes.map(r => <span key={r} className="cap-soc-tag">{socialRedLabel(r)}</span>)}
          </div>
          {c.descripcion && <div className="cap-soc-field"><label>Texto sugerido</label><p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13.5, color: '#3d4f6d' }}>{c.descripcion}</p>
            <button type="button" className="cap-soc-btn cap-soc-btn-ghost cap-soc-btn-sm" style={{ justifySelf: 'start' }} onClick={() => void navigator.clipboard.writeText(c.descripcion ?? '')}>Copiar texto</button></div>}
          <div className="cap-soc-meta"><Stars value={Number(c.calificacionPromedio) || 0} count={c.calificacionCount} /><span>⬇ {c.descargasTotal} descargas</span></div>
          <small style={{ color: '#64748b' }}>Subido el {fechaCorta(c.creadoEn)} · {formatBytes(c.tamanoBytes)}</small>

          <div className="cap-soc-dl" style={{ paddingTop: 12 }}>
            <small>{c.ultimaDescarga && !c.propio ? <>Lo descargaste el <b>{fechaCorta(c.ultimaDescarga)}</b>{c.bloqueadoHasta && <><br />Bloqueado por {tiempoRestante(c.bloqueadoHasta, now)}</>}</> : dl.hint}</small>
            <button type="button" className="cap-soc-btn" disabled={dl.blocked || downloading} onClick={() => onDownload(c)}>{downloading ? 'Descargando…' : dl.blocked ? dl.label : '⬇ Descargar'}</button>
          </div>

          <div className="cap-soc-field" style={{ marginTop: 6 }}>
            <label>¿Qué resultados te dio en redes?</label>
            {puedeEvaluar ? <>
              <div className="cap-soc-rate" role="radiogroup" aria-label="Estrellas">
                {[1, 2, 3, 4, 5].map(i => <button type="button" key={i} role="radio" aria-checked={estrellas === i} aria-label={`${i} estrellas`} className={i <= estrellas ? 'on' : ''} onClick={() => setEstrellas(i)}>★</button>)}
              </div>
              <select value={red} onChange={e => setRed(e.target.value)} aria-label="Dónde lo publicaste">
                <option value="">¿Dónde lo publicaste? (opcional)</option>
                {SOCIAL_REDES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                <option value="OTRA">Otra</option>
              </select>
              <textarea value={texto} maxLength={280} onChange={e => setTexto(e.target.value)} placeholder="Ej: 2.300 vistas en TikTok y 4 compradores nuevos" />
              <small>{texto.length}/280 · La evaluación es opcional y no afecta tus descargas.</small>
              <button type="button" className="cap-soc-btn cap-soc-btn-sm" style={{ justifySelf: 'start' }} onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : propia ? 'Actualizar evaluación' : 'Enviar evaluación'}</button>
            </> : <small>{c.propio ? 'Aquí verás lo que opinan los captadores que usan tu contenido.' : 'Descárgalo y publícalo para poder evaluar sus resultados.'}</small>}
            {msg && <small role="status" style={{ color: '#14459b', fontWeight: 650 }}>{msg}</small>}
          </div>

          <div className="cap-soc-reviews">
            {resenas.isLoading ? <small>Cargando reseñas…</small> : resenas.data?.length ? resenas.data.map(r => <div className="cap-soc-review" key={r.id}>
              <Avatar alias={r.autorAlias} foto={r.autorFoto} />
              <div><small><b style={{ color: '#0b2559' }}>@{r.autorAlias}</b> · {'★'.repeat(r.estrellas)}{r.redSocial ? ` · ${socialRedLabel(r.redSocial)}` : ''} · {fechaCorta(r.fecha)}</small>
                {r.resena && <p>{r.resena}</p>}</div>
            </div>) : <small style={{ color: '#7b8aa3' }}>Aún no hay reseñas.</small>}
          </div>
        </div>
      </div>
    </div>
  </div>;
}

export function SocialEditModal({ c, onClose, onSaved }: { c: SocialContenido; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(c.titulo);
  const [descripcion, setDescripcion] = useState(c.descripcion ?? '');
  const [categoria, setCategoria] = useState<SocialCategoria>(c.categoria);
  const [redes, setRedes] = useState<SocialRed[]>(c.redes);
  const [filtro, setFiltro] = useState<SocialFiltro>(c.filtroVisual);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try { await editSocialContenido(c.id, { titulo: titulo.trim(), descripcion: descripcion.trim() || undefined, categoria, redes, filtroVisual: filtro }); onSaved(); }
    catch (err) { setError(errorMessage(err, 'No pudimos guardar los cambios.')); }
    finally { setSaving(false); }
  }

  return <div className="cap-soc-overlay" role="dialog" aria-modal="true" aria-labelledby="cap-soc-edit-title" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="cap-soc-modal cap-soc-modal-sm" onSubmit={save}>
      <div className="cap-soc-modal-head"><h3 id="cap-soc-edit-title">Editar contenido</h3><button type="button" className="cap-soc-x" aria-label="Cerrar" onClick={onClose}>×</button></div>
      <div className="cap-soc-modal-body cap-soc-form">
        <div className="cap-soc-field"><label htmlFor="ed-titulo">Título</label><input id="ed-titulo" value={titulo} maxLength={80} onChange={e => setTitulo(e.target.value)} /></div>
        <div className="cap-soc-field"><label htmlFor="ed-desc">Texto sugerido</label><textarea id="ed-desc" value={descripcion} maxLength={500} onChange={e => setDescripcion(e.target.value)} /></div>
        <div className="cap-soc-field"><label htmlFor="ed-cat">Categoría</label><select id="ed-cat" value={categoria} onChange={e => setCategoria(e.target.value as SocialCategoria)}>{SOCIAL_CATEGORIAS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
        <div className="cap-soc-field"><label>Ideal para</label><div className="cap-soc-chips">{SOCIAL_REDES.map(r => <button type="button" key={r.value} className={`cap-soc-chip${redes.includes(r.value) ? ' on' : ''}`} onClick={() => setRedes(cur => cur.includes(r.value) ? cur.filter(x => x !== r.value) : [...cur, r.value])}>{r.label}</button>)}</div></div>
        {c.tipo === 'VIDEO' && <div className="cap-soc-field"><label htmlFor="ed-filtro">Filtro en el repositorio</label><select id="ed-filtro" value={filtro} onChange={e => setFiltro(e.target.value as SocialFiltro)}>{SOCIAL_FILTROS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>}
        {error && <div className="cap-soc-error" role="alert">{error}</div>}
        <div className="cap-soc-actions"><button type="button" className="cap-soc-btn cap-soc-btn-ghost" onClick={onClose}>Cancelar</button><button type="submit" className="cap-soc-btn" disabled={saving || titulo.trim().length < 3}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
      </div>
    </form>
  </div>;
}
