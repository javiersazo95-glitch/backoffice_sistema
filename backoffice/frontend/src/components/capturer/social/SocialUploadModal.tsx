import { useEffect, useMemo, useRef, useState } from 'react';
import { uploadSocialContenido, uploadSocialPoster } from '@/api/capturerSocial';
import type { SocialCategoria, SocialContenido, SocialFiltro, SocialRed } from '@/types/capturerSocial';
import { SOCIAL_CATEGORIAS, SOCIAL_FILTROS, SOCIAL_REDES, socialFiltroCss } from '@/types/capturerSocial';
import { IMAGE_MAX_BYTES, IMAGE_TYPES, VIDEO_MAX_BYTES, VIDEO_TYPES, analizarVideo, formatBytes, procesarImagen } from './media';

type Props = { alias: string; onClose: () => void; onDone: (c: SocialContenido) => void };

function errorMessage(err: unknown, fallback: string) {
  const e = err as { response?: { status?: number; data?: { message?: string } } };
  if (e.response?.status === 413) return 'El archivo supera el tamaño máximo permitido.';
  return e.response?.data?.message || fallback;
}

export default function SocialUploadModal({ alias, onClose, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [filtro, setFiltro] = useState<SocialFiltro>('ORIGINAL');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState<SocialCategoria>('PROMOCIONES');
  const [redes, setRedes] = useState<SocialRed[]>(['INSTAGRAM', 'TIKTOK']);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const esVideo = !!file && VIDEO_TYPES.includes(file.type);
  const subiendo = progress !== null;

  function elegir(f: File | undefined | null) {
    setError('');
    if (!f) return;
    const video = VIDEO_TYPES.includes(f.type);
    const imagen = IMAGE_TYPES.includes(f.type);
    if (!video && !imagen) { setError('Formato no soportado. Usa videos MP4, MOV o WebM, o imágenes JPG, PNG o WebP.'); return; }
    if (video && f.size > VIDEO_MAX_BYTES) { setError(`El video pesa ${formatBytes(f.size)}; el máximo es ${formatBytes(VIDEO_MAX_BYTES)}.`); return; }
    if (imagen && f.size > IMAGE_MAX_BYTES) { setError(`La imagen pesa ${formatBytes(f.size)}; el máximo es ${formatBytes(IMAGE_MAX_BYTES)}.`); return; }
    setFile(f);
    if (!titulo) setTitulo(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80));
  }

  function toggleRed(r: SocialRed) {
    setRedes(cur => (cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Elige un video o una imagen.'); return; }
    if (titulo.trim().length < 3) { setError('El título debe tener al menos 3 caracteres.'); return; }
    setError('');
    setProgress(0);
    try {
      let cuerpo: Blob = file;
      let filtroFinal: SocialFiltro = filtro;
      let poster: Blob | null = null;
      let duracion: number | null = null;
      if (esVideo) {
        const info = await analizarVideo(file);
        poster = info.poster; duracion = info.duracion;
      } else {
        // En imágenes el filtro y la marca de agua quedan dentro del archivo; si el navegador no
        // pudo aplicar el filtro, se guarda para que el feed lo muestre con CSS.
        const r = await procesarImagen(file, filtro, alias);
        cuerpo = r.blob;
        if (r.filtroHorneado) filtroFinal = 'ORIGINAL';
      }
      let creado = await uploadSocialContenido(cuerpo, {
        titulo: titulo.trim(), descripcion: descripcion.trim() || undefined, categoria, redes, filtroVisual: filtroFinal, duracionSeg: duracion,
      }, setProgress);
      if (poster) {
        try { creado = await uploadSocialPoster(creado.id, poster); } catch { /* la portada es opcional */ }
      }
      onDone(creado);
    } catch (err) {
      setProgress(null);
      setError(errorMessage(err, 'No pudimos subir el contenido. Inténtalo de nuevo.'));
    }
  }

  return <div className="cap-soc-overlay" role="dialog" aria-modal="true" aria-labelledby="cap-soc-up-title" onMouseDown={e => { if (e.target === e.currentTarget && !subiendo) onClose(); }}>
    <form className="cap-soc-modal" onSubmit={submit}>
      <div className="cap-soc-modal-head">
        <h3 id="cap-soc-up-title">Subir contenido para redes</h3>
        <button type="button" className="cap-soc-x" aria-label="Cerrar" onClick={onClose} disabled={subiendo}>×</button>
      </div>
      <div className="cap-soc-modal-body">
        <div className="cap-soc-split">
          <div className="cap-soc-form">
            {!file ? <div className={`cap-soc-drop${drag ? ' drag' : ''}`} role="button" tabIndex={0}
              onClick={() => inputRef.current?.click()} onKeyDown={e => { if (e.key === 'Enter') inputRef.current?.click(); }}
              onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); elegir(e.dataTransfer.files?.[0]); }}>
              <span style={{ fontSize: 34 }}>🎬</span>
              <strong>Arrastra tu video o imagen aquí</strong>
              <span>o haz clic para elegir un archivo</span>
              <small>Videos MP4/MOV/WebM hasta {formatBytes(VIDEO_MAX_BYTES)} · Imágenes JPG/PNG/WebP hasta {formatBytes(IMAGE_MAX_BYTES)}</small>
            </div> : <>
              <div className="cap-soc-preview">
                {esVideo
                  ? <video src={previewUrl} controls muted playsInline style={{ filter: socialFiltroCss(filtro) }} />
                  : <img src={previewUrl} alt="Vista previa" style={{ filter: socialFiltroCss(filtro) }} />}
                <span className="cap-soc-watermark">@{alias} · RepuesTop</span>
              </div>
              <div className="cap-soc-presets" aria-label="Filtros">
                {SOCIAL_FILTROS.map(f => <button type="button" key={f.value} className={`cap-soc-preset${filtro === f.value ? ' on' : ''}`} onClick={() => setFiltro(f.value)} disabled={subiendo}>
                  <span style={esVideo ? { background: '#27406f', filter: f.css } : { backgroundImage: `url(${previewUrl})`, filter: f.css }} />
                  {f.label}
                </button>)}
              </div>
              <small className="cap-soc-field" style={{ color: '#7b8aa3', fontSize: 11.5 }}>
                {esVideo ? 'En videos el filtro se ve en el repositorio; al descargar se entrega el video original.' : 'El filtro y tu marca de agua quedan dentro de la imagen.'}
                {' '}{formatBytes(file.size)}
              </small>
              {!subiendo && <button type="button" className="cap-soc-btn cap-soc-btn-ghost cap-soc-btn-sm" onClick={() => { setFile(null); setFiltro('ORIGINAL'); }}>Cambiar archivo</button>}
            </>}
            <input ref={inputRef} type="file" hidden accept={[...VIDEO_TYPES, ...IMAGE_TYPES].join(',')} onChange={e => elegir(e.target.files?.[0])} />
          </div>

          <div className="cap-soc-form">
            <div className="cap-soc-field">
              <label htmlFor="soc-titulo">Título *</label>
              <input id="soc-titulo" value={titulo} maxLength={80} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Pastillas de freno con despacho gratis" disabled={subiendo} />
              <small>{titulo.length}/80</small>
            </div>
            <div className="cap-soc-field">
              <label htmlFor="soc-desc">Texto sugerido para publicar</label>
              <textarea id="soc-desc" value={descripcion} maxLength={500} onChange={e => setDescripcion(e.target.value)} placeholder="Copy, hashtags y llamado a la acción. Ej: Encuentra tu repuesto en repuestop.cl #repuestos" disabled={subiendo} />
              <small>{descripcion.length}/500</small>
            </div>
            <div className="cap-soc-field">
              <label htmlFor="soc-cat">Categoría *</label>
              <select id="soc-cat" value={categoria} onChange={e => setCategoria(e.target.value as SocialCategoria)} disabled={subiendo}>
                {SOCIAL_CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="cap-soc-field">
              <label>Ideal para</label>
              <div className="cap-soc-chips">
                {SOCIAL_REDES.map(r => <button type="button" key={r.value} className={`cap-soc-chip${redes.includes(r.value) ? ' on' : ''}`} onClick={() => toggleRed(r.value)} disabled={subiendo}>{r.label}</button>)}
              </div>
            </div>
            <div className="cap-soc-banner info">Tu contenido queda en el repositorio compartido con tu @{alias}. Subir 3 videos cada 7 días te da acceso para descargar el de los demás.</div>
            {error && <div className="cap-soc-error" role="alert">{error}</div>}
            {subiendo && <div><div className="cap-soc-progress"><div style={{ width: `${progress}%` }} /></div><small style={{ color: '#64748b' }}>{progress! < 100 ? `Subiendo… ${progress}%` : 'Procesando…'}</small></div>}
            <div className="cap-soc-actions">
              <button type="button" className="cap-soc-btn cap-soc-btn-ghost" onClick={onClose} disabled={subiendo}>Cancelar</button>
              <button type="submit" className="cap-soc-btn" disabled={!file || subiendo}>{subiendo ? 'Publicando…' : 'Publicar en el repositorio'}</button>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>;
}
