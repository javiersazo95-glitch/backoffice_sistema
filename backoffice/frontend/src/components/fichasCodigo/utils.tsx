import type { FichaEstado } from '@/types/fichaCodigo';

export function estadoPill(estado: FichaEstado | string) {
  if (estado === 'VERIFICADA') return <span className="status-pill tone-green">Verificada</span>;
  if (estado === 'RECHAZADA') return <span className="status-pill tone-red">Rechazada</span>;
  return <span className="status-pill tone-amber">Sin verificar</span>;
}

export function fechaCorta(valor: string | null | undefined): string {
  if (!valor) return '—';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Santiago' });
}
