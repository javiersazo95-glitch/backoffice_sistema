/**
 * Antiguedad de un registro a partir de su fecha ISO. Los dashboards la usan para decir
 * "hace 3 h" o "hace 2 d" y para colorear por urgencia. Todo en milisegundos reales: no importa
 * la zona horaria porque se compara con `Date.now()`.
 */

const HOUR = 3_600_000;

export function hoursSince(iso?: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return Math.max(0, (now - time) / HOUR);
}

export function daysSince(iso?: string | null, now = Date.now()): number | null {
  const hours = hoursSince(iso, now);
  return hours === null ? null : hours / 24;
}

/** "hace 40 min", "hace 3 h", "hace 2 d" o "sin fecha". */
export function formatAge(iso?: string | null, now = Date.now()): string {
  const hours = hoursSince(iso, now);
  if (hours === null) return 'sin fecha';
  if (hours < 1) return `hace ${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `hace ${Math.round(hours)} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/** Azul mientras es reciente, ambar desde `warnHours`, rojo desde `critHours`. */
export function ageTone(hours: number | null, warnHours: number, critHours: number): 'blue' | 'amber' | 'red' {
  if (hours === null) return 'blue';
  if (hours >= critHours) return 'red';
  if (hours >= warnHours) return 'amber';
  return 'blue';
}

/** "24h" -> 24. El backend manda el SLA de un ticket como texto segun su categoria. */
export function slaHours(sla?: string | null): number | null {
  if (!sla) return null;
  const match = /(\d+)\s*h/i.exec(sla);
  return match?.[1] ? Number(match[1]) : null;
}

/** "YYYY-MM-DD" de hoy en hora de Chile, para filtros de "hoy" contra el backend. */
export function hoyChile(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
