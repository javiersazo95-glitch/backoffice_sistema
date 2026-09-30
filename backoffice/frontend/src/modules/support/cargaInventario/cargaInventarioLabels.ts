import type { ContextoChat, EstadoChat, EstadoChatEditable, FiltroEstadoChat, MotivoChat, ResumenChats } from '@/api/supportCargaInventario';
import { CHILE_TIME_ZONE, hasTimeZone, toChileIso } from '@/utils/formatters';

export const ESTADO_LABELS: Record<EstadoChat, string> = {
  ESPERANDO_SOPORTE: 'Esperando soporte',
  EN_ATENCION: 'En atención',
  ESPERANDO_VENDEDOR: 'Esperando al vendedor',
  CERRADO_POR_VENDEDOR: 'Cerrado por el vendedor',
  CERRADO_POR_INACTIVIDAD: 'Cerrado por inactividad',
};

/** Variante de Badge; '' pinta el badge neutro (gris) con la clase carga-badge-neutral. */
export const ESTADO_TONES: Record<EstadoChat, string> = {
  ESPERANDO_SOPORTE: 'amber',
  EN_ATENCION: 'blue',
  ESPERANDO_VENDEDOR: 'violet',
  CERRADO_POR_VENDEDOR: 'green',
  CERRADO_POR_INACTIVIDAD: '',
};

export const MOTIVO_LABELS: Record<MotivoChat, string> = {
  DUDA: 'Tiene una duda',
  ERROR: 'Algo no funciona',
  AYUDA_CARGA: 'Ayuda para cargar inventario',
  OTRO: 'Otro',
};

/** Estados que soporte puede elegir en el selector (el cierre es solo del vendedor o del sistema). */
export const ESTADOS_EDITABLES: Array<{ value: EstadoChatEditable; label: string }> = [
  { value: 'ESPERANDO_SOPORTE', label: 'Esperando soporte' },
  { value: 'EN_ATENCION', label: 'En atención' },
  { value: 'ESPERANDO_VENDEDOR', label: 'Esperando al vendedor' },
];

export const FILTROS_ESTADO: Array<{ value: FiltroEstadoChat; label: string }> = [
  { value: 'ABIERTOS', label: 'Abiertas' },
  { value: 'ESPERANDO_SOPORTE', label: 'Esperando soporte' },
  { value: 'EN_ATENCION', label: 'En atención' },
  { value: 'ESPERANDO_VENDEDOR', label: 'Esperando vendedor' },
  { value: 'CERRADOS', label: 'Cerradas' },
];

export function isChatCerrado(estado: EstadoChat): boolean {
  return estado === 'CERRADO_POR_VENDEDOR' || estado === 'CERRADO_POR_INACTIVIDAD';
}

export function contarFiltro(resumen: ResumenChats | undefined, filtro: FiltroEstadoChat): number | null {
  if (!resumen) return null;
  const porEstado = resumen.porEstado ?? {};
  if (filtro === 'ABIERTOS') return resumen.abiertos;
  if (filtro === 'CERRADOS') return (porEstado.CERRADO_POR_VENDEDOR ?? 0) + (porEstado.CERRADO_POR_INACTIVIDAD ?? 0);
  return porEstado[filtro] ?? 0;
}

const FLUJO_LABELS: Record<string, string> = {
  'mi-excel': 'Mi propio Excel',
  plantilla: 'Plantilla oficial',
  otro: 'Otra sección',
};

/**
 * "Paso 3 · Completa — archivo inventario.xlsx (1.234 filas)". El contexto lo arma el panel del
 * vendedor y todos sus campos son opcionales; devuelve null si no hay nada que mostrar.
 */
export function describirContexto(contexto: ContextoChat | null | undefined): { flujo: string | null; detalle: string | null } | null {
  if (!contexto || typeof contexto !== 'object') return null;
  const flujo = contexto.flujo ? (FLUJO_LABELS[contexto.flujo] ?? contexto.flujo) : null;

  const partes: string[] = [];
  const paso = typeof contexto.paso === 'number' ? `Paso ${contexto.paso}` : null;
  const titulo = contexto.pasoTitulo?.trim() || contexto.vista?.trim() || null;
  const etapa = [paso, titulo].filter(Boolean).join(' · ');
  if (etapa) partes.push(etapa);

  if (contexto.archivoNombre) {
    const filas = typeof contexto.filas === 'number'
      ? ` (${contexto.filas.toLocaleString('es-CL')} ${contexto.filas === 1 ? 'fila' : 'filas'})`
      : '';
    partes.push(`archivo ${contexto.archivoNombre}${filas}`);
  } else if (typeof contexto.filas === 'number') {
    partes.push(`${contexto.filas.toLocaleString('es-CL')} ${contexto.filas === 1 ? 'fila' : 'filas'}`);
  }

  const detalle = partes.length ? partes.join(' — ') : null;
  if (!flujo && !detalle) return null;
  return { flujo, detalle };
}

const horaChile = new Intl.DateTimeFormat('es-CL', {
  timeZone: CHILE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function diaChile(date: Date): string {
  return toChileIso(date.toISOString()).slice(0, 10);
}

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Sin zona el backend ya lo manda en hora de Chile; se interpreta igual que formatDateTime.
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** "14:32" en hora de Chile. */
export function formatHora(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return '';
  if (value && !hasTimeZone(value)) return value.slice(11, 16);
  return horaChile.format(date);
}

/** "dd/mm" o "dd/mm/aaaa" (si es de otro año) en hora de Chile. */
function formatDia(date: Date, ahora: Date): string {
  const iso = diaChile(date);
  const [anio, mes, dia] = iso.split('-');
  return anio === diaChile(ahora).slice(0, 4) ? `${dia}/${mes}` : `${dia}/${mes}/${anio}`;
}

/** "Ahora", "hace 5 min", "hace 3 h", "ayer 14:32" o "27/09 14:32" (hora de Chile). */
export function formatRelativo(value: string | null | undefined, ahora: Date = new Date()): string {
  const date = parse(value);
  if (!date) return '';
  const diffMin = Math.floor((ahora.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffMin < 6 * 60) return `hace ${Math.floor(diffMin / 60)} h`;

  const hoy = diaChile(ahora);
  const ayer = diaChile(new Date(ahora.getTime() - 24 * 60 * 60 * 1000));
  const dia = diaChile(date);
  if (dia === hoy) return `hoy ${horaChile.format(date)}`;
  if (dia === ayer) return `ayer ${horaChile.format(date)}`;
  return `${formatDia(date, ahora)} ${horaChile.format(date)}`;
}

/** Fecha y hora completa para tooltips y separadores: "27/09 14:32". */
export function formatFechaHora(value: string | null | undefined, ahora: Date = new Date()): string {
  const date = parse(value);
  if (!date) return '';
  return `${formatDia(date, ahora)} ${horaChile.format(date)}`;
}

/** Cuánto falta para el cierre automático: "en 5 h (hoy 18:30)", "en 40 min" o "pronto". */
export function formatCierreAutomatico(value: string | null | undefined, ahora: Date = new Date()): string {
  const date = parse(value);
  if (!date) return '';
  const diffMin = Math.floor((date.getTime() - ahora.getTime()) / 60000);
  if (diffMin <= 0) return 'pronto';
  const hoy = diaChile(ahora);
  const manana = diaChile(new Date(ahora.getTime() + 24 * 60 * 60 * 1000));
  const dia = diaChile(date);
  const cuando = dia === hoy ? `hoy ${horaChile.format(date)}` : dia === manana ? `mañana ${horaChile.format(date)}` : formatFechaHora(value, ahora);
  if (diffMin < 60) return `en ${diffMin} min (${cuando})`;
  return `en ${Math.floor(diffMin / 60)} h (${cuando})`;
}

/** Mensaje de error del backend (campo message) o el texto por defecto. */
export function mensajeDeError(error: unknown, porDefecto: string): string {
  const data = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data;
  if (data && typeof data.message === 'string' && data.message.trim()) return data.message;
  return porDefecto;
}
