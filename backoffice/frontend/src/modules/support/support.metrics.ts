import type { TicketResponse } from '@/api/support';
import { hoursSince, slaHours } from '@/utils/age';

/**
 * Metricas de Soporte calculadas sobre el listado completo de tickets (sin QA).
 *
 * Son funciones puras para poder probarlas y para que el resumen y las sugerencias usen
 * exactamente la misma definicion de "sin responder" o "fuera de plazo".
 */

const CLOSED = new Set(['RESUELTO', 'CERRADO', 'CANCELADO']);
/** Plazo por defecto cuando el ticket no trae `sla` (tickets automaticos). */
export const DEFAULT_SLA_HOURS = 48;
const DAY_MS = 86_400_000;

export function isOpen(ticket: TicketResponse): boolean {
  return !CLOSED.has(ticket.status);
}

/** Nunca ha recibido respuesta de soporte. */
export function isUnanswered(ticket: TicketResponse): boolean {
  return ticket.status === 'ABIERTO' && !ticket.respondedAt;
}

export function ticketSlaHours(ticket: TicketResponse): number {
  return slaHours(ticket.sla) ?? DEFAULT_SLA_HOURS;
}

/** Sigue sin respuesta y ya paso el plazo de su categoria (24/48/72 h). */
export function isSlaBreached(ticket: TicketResponse, now = Date.now()): boolean {
  return isUnanswered(ticket) && (hoursSince(ticket.createdAt, now) ?? 0) > ticketSlaHours(ticket);
}

/** true si la primera respuesta llego dentro del plazo, false si tarde, null si aun no responde. */
export function respondedWithinSla(ticket: TicketResponse): boolean | null {
  if (!ticket.respondedAt) return null;
  const created = Date.parse(ticket.createdAt);
  const responded = Date.parse(ticket.respondedAt);
  if (Number.isNaN(created) || Number.isNaN(responded)) return null;
  return (responded - created) / 3_600_000 <= ticketSlaHours(ticket);
}

export interface SupportMetrics {
  /** Sin respuesta, del mas antiguo al mas nuevo. */
  unanswered: TicketResponse[];
  unansweredOver24h: number;
  slaBreached: number;
  slaBreachedByCategory: Record<string, number>;
  urgentOpen: number;
  criticalUnanswered: number;
  resolvedPendingClose: number;
  autoCloseToday: number;
  openByPriority: Record<string, number>;
  openByPlatform: Record<string, number>;
  createdByDay: { key: string; label: string; value: number }[];
  /** Respuesta a tiempo en los ultimos 30 dias: respondidos dentro del plazo sobre los que ya tienen desenlace. */
  onTime: { ok: number; late: number; rate: number | null };
}

const PLATFORM_NONE = 'SIN_PLATAFORMA';

function dayKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function dayLabel(ms: number): string {
  return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit' }).format(new Date(ms));
}

export function summarizeTickets(tickets: TicketResponse[], now = Date.now()): SupportMetrics {
  const unanswered = tickets.filter(isUnanswered).sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
  const breached = unanswered.filter((t) => isSlaBreached(t, now));
  const open = tickets.filter(isOpen);

  const slaBreachedByCategory: Record<string, number> = {};
  breached.forEach((t) => { slaBreachedByCategory[t.category] = (slaBreachedByCategory[t.category] ?? 0) + 1; });

  const openByPriority: Record<string, number> = {};
  const openByPlatform: Record<string, number> = {};
  open.forEach((t) => {
    openByPriority[t.priority] = (openByPriority[t.priority] ?? 0) + 1;
    const platform = t.platform || PLATFORM_NONE;
    openByPlatform[platform] = (openByPlatform[platform] ?? 0) + 1;
  });

  const endOfToday = (() => {
    const key = dayKey(now);
    // Fin del dia en Chile: el ultimo instante del dia de hoy, aproximado con el inicio de manana.
    return Date.parse(`${key}T23:59:59-03:00`);
  })();

  const createdByDay: SupportMetrics['createdByDay'] = [];
  const counts = new Map<string, number>();
  tickets.forEach((t) => {
    const created = Date.parse(t.createdAt);
    if (Number.isNaN(created) || now - created > 14 * DAY_MS) return;
    const key = dayKey(created);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  for (let offset = 13; offset >= 0; offset -= 1) {
    const ms = now - offset * DAY_MS;
    const key = dayKey(ms);
    createdByDay.push({ key, label: dayLabel(ms), value: counts.get(key) ?? 0 });
  }

  let ok = 0;
  let late = 0;
  tickets.forEach((t) => {
    const created = Date.parse(t.createdAt);
    if (Number.isNaN(created) || now - created > 30 * DAY_MS) return;
    const within = respondedWithinSla(t);
    if (within === true) ok += 1;
    else if (within === false || isSlaBreached(t, now)) late += 1;
  });

  return {
    unanswered,
    unansweredOver24h: unanswered.filter((t) => (hoursSince(t.createdAt, now) ?? 0) > 24).length,
    slaBreached: breached.length,
    slaBreachedByCategory,
    urgentOpen: open.filter((t) => t.priority === 'CRITICA' || t.priority === 'ALTA').length,
    criticalUnanswered: unanswered.filter((t) => t.priority === 'CRITICA').length,
    resolvedPendingClose: tickets.filter((t) => t.status === 'RESUELTO').length,
    autoCloseToday: tickets.filter((t) => t.status === 'RESUELTO' && t.autoCloseAt && Date.parse(t.autoCloseAt) <= endOfToday).length,
    openByPriority,
    openByPlatform,
    createdByDay,
    onTime: { ok, late, rate: ok + late > 0 ? Math.round((ok / (ok + late)) * 100) : null },
  };
}

export const PLATFORM_LABELS: Record<string, string> = {
  ADMINISTRACION_CONTABLE: 'Administración Contable',
  MEDIACION_CONFIANZA: 'Mediación y Confianza',
  APP_MOBILE: 'App móvil',
  SOPORTE: 'Soporte',
  SITIO_WEB: 'Sitio web',
  [PLATFORM_NONE]: 'Sin plataforma',
};

export const CATEGORY_LABELS: Record<string, string> = {
  FALLA_TECNICA: 'Fallas técnicas',
  SOLICITUD_AYUDA: 'Solicitudes de ayuda',
  CONSULTA: 'Consultas',
};
