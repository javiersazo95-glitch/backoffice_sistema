const HOUR = 3_600_000;

/** Umbrales del semáforo de antigüedad (horas) para una publicación sin respuestas. */
export const AGE_WARNING_HOURS = 24;
export const AGE_CRITICAL_HOURS = 72;

export function ageInHours(date?: string | null, now = Date.now()): number | null {
  if (!date) return null;
  const time = new Date(date).getTime();
  return Number.isNaN(time) ? null : Math.max(0, (now - time) / HOUR);
}

/** "hace 5 h", "hace 3 d", "hace 2 meses". */
export function formatAge(date?: string | null, now = Date.now()): string {
  const hours = ageInHours(date, now);
  if (hours == null) return 'Sin fecha';
  if (hours < 1) return 'hace minutos';
  if (hours < 48) return `hace ${Math.floor(hours)} h`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `hace ${days} d`;
  return `hace ${Math.floor(days / 30)} meses`;
}

/** Verde: menos de 24 h; ámbar: hasta 72 h; rojo: más de 72 h. */
export function ageTone(date?: string | null, now = Date.now()): 'green' | 'amber' | 'red' {
  const hours = ageInHours(date, now);
  if (hours == null || hours < AGE_WARNING_HOURS) return 'green';
  return hours < AGE_CRITICAL_HOURS ? 'amber' : 'red';
}
