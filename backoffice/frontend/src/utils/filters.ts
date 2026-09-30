/**
 * Cuenta cuantos filtros tienen un valor distinto del "vacio" o del valor por defecto.
 * Se usa para el contador del boton "Filtros (n)" en la experiencia movil.
 */
export function countActiveFilters(
  values: Record<string, unknown>,
  defaults: Record<string, unknown> = {},
): number {
  return Object.entries(values).reduce((count, [key, value]) => {
    const fallback = defaults[key];
    if (value === undefined || value === null) return count;
    if (typeof value === 'string' && value.trim() === '') return count;
    if (Array.isArray(value) && value.length === 0) return count;
    if (fallback !== undefined && value === fallback) return count;
    if (fallback === undefined && (value === 'ALL' || value === 'TODOS' || value === 'all' || value === 'todos')) return count;
    return count + 1;
  }, 0);
}
