import { socialFiltroCss } from '@/types/capturerSocial';
import type { SocialFiltro } from '@/types/capturerSocial';

export const VIDEO_MAX_BYTES = 80 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_MAX_SIDE = 2160;

/** ¿El canvas sabe aplicar `ctx.filter`? (Safari antiguo lo ignora en silencio). */
export function canvasFilterSupported(): boolean {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx || !('filter' in ctx)) return false;
    ctx.filter = 'grayscale(1)';
    return ctx.filter === 'grayscale(1)';
  } catch {
    return false;
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No pudimos leer la imagen')); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No pudimos procesar la imagen'))), type, quality));
}

/**
 * "Hornea" el filtro elegido y la marca de agua @alias en la imagen antes de subirla, para que
 * lo que descargue otro captador ya lleve ambos. Devuelve si el filtro quedó aplicado: si el
 * navegador no soporta filtros en canvas se sube sin él y el feed lo aplica con CSS.
 */
export async function procesarImagen(file: File, filtro: SocialFiltro, alias: string): Promise<{ blob: Blob; filtroHorneado: boolean }> {
  const img = await loadImage(file);
  const escala = Math.min(1, IMAGE_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * escala));
  const h = Math.max(1, Math.round(img.naturalHeight * escala));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: file, filtroHorneado: false };
  const puedeFiltrar = filtro !== 'ORIGINAL' && canvasFilterSupported();
  if (puedeFiltrar) ctx.filter = socialFiltroCss(filtro);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = 'none';
  // Marca de agua: pastilla semitransparente abajo a la izquierda (misma esquina que la del
  // video en el feed; la derecha la ocupan las etiquetas de la tarjeta).
  const texto = `@${alias} · RepuesTop`;
  const fs = Math.max(14, Math.round(Math.min(w, h) * 0.035));
  ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
  const tw = ctx.measureText(texto).width;
  const pad = Math.round(fs * 0.55);
  const bx = pad * 2;
  const by = h - fs - pad * 3;
  ctx.fillStyle = 'rgba(11,37,89,.55)';
  const r = fs * 0.6;
  ctx.beginPath();
  ctx.roundRect?.(bx, by, tw + pad * 2, fs + pad * 1.4, r);
  if (!ctx.roundRect) ctx.rect(bx, by, tw + pad * 2, fs + pad * 1.4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, bx + pad, by + (fs + pad * 1.4) / 2);
  const tipo = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, tipo, tipo === 'image/jpeg' ? 0.9 : undefined);
  return { blob, filtroHorneado: puedeFiltrar };
}

/** Portada (frame ~1s) y duración de un video, sacadas en el navegador (el backend no procesa video). */
export function analizarVideo(file: File): Promise<{ poster: Blob | null; duracion: number | null }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let terminado = false;
    const fin = (poster: Blob | null, duracion: number | null) => {
      if (terminado) return; terminado = true;
      URL.revokeObjectURL(url); resolve({ poster, duracion });
    };
    video.muted = true; video.playsInline = true; video.preload = 'metadata'; video.src = url;
    video.onerror = () => fin(null, null);
    video.onloadedmetadata = () => {
      const dur = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
      video.onseeked = async () => {
        try {
          const escala = Math.min(1, 720 / Math.max(video.videoWidth || 720, 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((video.videoWidth || 720) * escala));
          canvas.height = Math.max(1, Math.round((video.videoHeight || 1280) * escala));
          canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
          fin(await canvasToBlob(canvas, 'image/jpeg', 0.82), dur);
        } catch { fin(null, dur); }
      };
    };
    window.setTimeout(() => fin(null, null), 8000);
  });
}

export function formatBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function formatDuracion(seg: number | null | undefined) {
  if (!seg && seg !== 0) return '';
  const m = Math.floor(seg / 60); const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "13 d 4 h", "5 h 20 min", "12 min". */
export function tiempoRestante(iso: string | null | undefined, ahora: number) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - ahora;
  if (ms <= 0) return 'ya disponible';
  const min = Math.ceil(ms / 60000);
  const d = Math.floor(min / 1440); const h = Math.floor((min % 1440) / 60); const m = min % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export function fechaCorta(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
