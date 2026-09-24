import { useEffect, useRef, useState } from 'react';
import CapturerAvatar from '@/components/capturers/CapturerAvatar';
import { socialMediaUrl } from '@/api/capturerSocial';
import type { SocialContenido } from '@/types/capturerSocial';
import { socialCategoriaLabel, socialFiltroCss, socialRedLabel } from '@/types/capturerSocial';
import { fechaCorta, formatDuracion, tiempoRestante } from './media';

type Props = {
  c: SocialContenido;
  now: number;
  downloading: boolean;
  onOpen: (c: SocialContenido) => void;
  onDownload: (c: SocialContenido) => void;
  /** Tarjeta de "Mis contenidos": diseño propio (acento violeta, métricas y acciones). */
  variant?: 'feed' | 'mine';
  onEdit?: (c: SocialContenido) => void;
  onDelete?: (c: SocialContenido) => void;
};

export function Stars({ value, count }: { value: number; count: number }) {
  const redondeo = Math.round(value);
  return <span className="cap-soc-stars" aria-label={`${value.toFixed(1)} de 5 estrellas, ${count} evaluaciones`}>
    {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ color: i <= redondeo ? '#f5a524' : '#d7dfeb', margin: 0 }}>★</span>)}
    <span>{count ? value.toFixed(1) : 'Sin evaluar'}{count ? ` (${count})` : ''}</span>
  </span>;
}

export function Avatar({ alias, foto }: { alias: string; foto: string | null }) {
  return <CapturerAvatar className="cap-soc-avatar" nombre={alias} fotoPerfil={foto} />;
}

/** Texto del botón y del contador según por qué (no) se puede descargar. */
export function downloadState(c: SocialContenido, now: number) {
  if (c.propio) return { label: 'Descargar', hint: 'Tu contenido no consume cupo', blocked: false };
  switch (c.motivoBloqueo) {
    case 'BLOQUEO_14_DIAS': return { label: 'Bloqueado', hint: `Disponible en ${tiempoRestante(c.bloqueadoHasta, now)}`, blocked: true };
    case 'SIN_ACCESO': return { label: 'Sin acceso', hint: 'Sube 3 videos esta semana', blocked: true };
    case 'CUPO_AGOTADO': return { label: 'Cupo agotado', hint: 'Se reinicia el lunes', blocked: true };
    case 'NO_DISPONIBLE': return { label: 'No disponible', hint: 'Oculto por moderación', blocked: true };
    case 'SUSPENDIDO': return { label: 'Suspendido', hint: 'Acceso suspendido por moderación', blocked: true };
    default: return { label: 'Descargar', hint: 'Usa 1 descarga de tu cupo', blocked: false };
  }
}

/** Dispositivos sin mouse (celulares, tablets): ahí la vista previa parte al quedar la tarjeta en pantalla. */
const sinHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;

/**
 * Vista previa del video: se reproduce SIN AUDIO al pasar el mouse (o al enfocarla con teclado) y
 * vuelve al primer cuadro al salir. En pantallas táctiles se reproduce al estar visible.
 */
function useVistaPrevia(activo: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [avance, setAvance] = useState(0);

  const play = () => {
    const v = videoRef.current;
    if (!activo || !v) return;
    // React no siempre refleja `muted` en el elemento; sin esto el navegador bloquea el autoplay.
    v.muted = true;
    v.defaultMuted = true;
    v.volume = 0;
    void v.play().then(() => setReproduciendo(true)).catch(() => setReproduciendo(false));
  };
  const stop = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setReproduciendo(false);
    setAvance(0);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!activo || !v) return undefined;
    const onTime = () => setAvance(v.duration ? v.currentTime / v.duration : 0);
    v.addEventListener('timeupdate', onTime);
    let observer: IntersectionObserver | undefined;
    if (sinHover() && contenedorRef.current && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.6) play(); else stop();
      }, { threshold: [0, 0.6] });
      observer.observe(contenedorRef.current);
    }
    return () => { v.removeEventListener('timeupdate', onTime); observer?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  return { videoRef, contenedorRef, reproduciendo, avance, play, stop };
}

export default function SocialPostCard({ c, now, downloading, onOpen, onDownload, variant = 'feed', onEdit, onDelete }: Props) {
  const preview = useVistaPrevia(c.tipo === 'VIDEO');
  const mine = variant === 'mine' || c.propio;
  const dl = downloadState(c, now);
  const filter = socialFiltroCss(c.filtroVisual);
  const poster = c.posterUrl ? socialMediaUrl(c.posterUrl) : undefined;
  const locked = c.motivoBloqueo === 'BLOQUEO_14_DIAS' && !c.propio;

  return <article className={`cap-soc-post${mine ? ' mine' : ''}${c.estado === 'OCULTO' ? ' hidden-post' : ''}`}>
    <div ref={preview.contenedorRef} className={`cap-soc-media${preview.reproduciendo ? ' playing' : ''}`} onClick={() => onOpen(c)}
      onMouseEnter={preview.play} onMouseLeave={preview.stop} onFocus={preview.play} onBlur={preview.stop}
      role="button" tabIndex={0} aria-label={`Ver ${c.titulo}`} onKeyDown={e => { if (e.key === 'Enter') onOpen(c); }}>
      {c.tipo === 'VIDEO'
        ? <video ref={preview.videoRef} src={socialMediaUrl(c.url)} poster={poster} muted loop playsInline preload="metadata" disablePictureInPicture onContextMenu={e => e.preventDefault()} style={{ filter }} />
        : <img src={socialMediaUrl(c.url)} alt={c.titulo} loading="lazy" style={{ filter }} />}
      {c.tipo === 'VIDEO' && !preview.reproduciendo && <span className="cap-soc-play-hint" aria-hidden="true">▶</span>}
      {c.tipo === 'VIDEO' && preview.reproduciendo && <>
        <span className="cap-soc-muted-chip" aria-hidden="true">🔇 Vista previa</span>
        <span className="cap-soc-preview-bar" aria-hidden="true"><span style={{ width: `${preview.avance * 100}%` }} /></span>
      </>}
      <span className="cap-soc-author"><Avatar alias={c.autorAlias} foto={c.autorFoto} /><span>@{c.autorAlias}</span></span>
      <span className="cap-soc-type">{c.tipo === 'VIDEO' ? <>▶ {formatDuracion(c.duracionSeg) || 'Video'}</> : 'Imagen'}</span>
      {c.tipo === 'VIDEO' && <span className="cap-soc-watermark">@{c.autorAlias}</span>}
      {mine && <span className="cap-soc-ribbon">Tuyo</span>}
      {locked && <div className="cap-soc-lock"><strong>🔒 Ya la descargaste</strong><small>Vuelve a estar disponible en {tiempoRestante(c.bloqueadoHasta, now)}</small></div>}
    </div>
    <div className="cap-soc-body">
      <h3 className="cap-soc-title">{c.titulo}</h3>
      <div className="cap-soc-tags">
        <span className="cap-soc-tag cap-soc-tag-cat">{socialCategoriaLabel(c.categoria)}</span>
        {c.redes.slice(0, 3).map(r => <span key={r} className="cap-soc-tag">{socialRedLabel(r)}</span>)}
      </div>
      <div className="cap-soc-meta"><Stars value={Number(c.calificacionPromedio) || 0} count={c.calificacionCount} /><span>⬇ {c.descargasTotal}</span></div>

      {variant === 'mine' ? <>
        <div className="cap-soc-mine-stats">
          <div><b>{c.descargasTotal}</b><small>Descargas</small></div>
          <div><b>{c.calificacionCount ? Number(c.calificacionPromedio).toFixed(1) : '—'}</b><small>Promedio</small></div>
          <div><b>{c.calificacionCount}</b><small>Reseñas</small></div>
        </div>
        {c.estado === 'OCULTO' && <div className="cap-soc-hidden-note">Oculto por moderación: no aparece en el repositorio ni cuenta para tu requisito semanal.</div>}
        <div className="cap-soc-dl">
          <small>Subido el <b>{fechaCorta(c.creadoEn)}</b></small>
          <span style={{ display: 'flex', gap: 6 }}>
            {onEdit && <button type="button" className="cap-soc-btn cap-soc-btn-ghost cap-soc-btn-sm" onClick={() => onEdit(c)}>Editar</button>}
            {onDelete && <button type="button" className="cap-soc-btn cap-soc-btn-danger cap-soc-btn-sm" onClick={() => onDelete(c)}>Eliminar</button>}
          </span>
        </div>
      </> : <div className="cap-soc-dl">
        {c.ultimaDescarga && !c.propio
          ? <small>Descargado el <b>{fechaCorta(c.ultimaDescarga)}</b><br />{c.bloqueadoHasta
            ? <span className="cap-soc-counter">⏳ {tiempoRestante(c.bloqueadoHasta, now)}</span>
            : <span className="cap-soc-counter ok">✓ Disponible otra vez</span>}</small>
          : <small>{dl.hint}</small>}
        <button type="button" className="cap-soc-btn cap-soc-btn-sm" disabled={dl.blocked || downloading} onClick={() => onDownload(c)}>
          {downloading ? 'Descargando…' : dl.blocked ? dl.label : '⬇ Descargar'}
        </button>
      </div>}
    </div>
  </article>;
}
