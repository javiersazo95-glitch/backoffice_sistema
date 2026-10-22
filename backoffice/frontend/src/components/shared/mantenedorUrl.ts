import { MANTENEDOR_URL_FALLBACK } from '@/components/layout/navConfig';

/**
 * URL del Mantenedor común para los enlaces del shell. Vive fuera de `navConfig.ts` porque ese
 * archivo se copia a Backoffice_movil y allí `import.meta` no existe. Una variable vacía en el
 * `.env` cae también al dominio por defecto.
 */
export const MANTENEDOR_URL: string = (import.meta.env.VITE_MANTENEDOR_URL ?? '').trim() || MANTENEDOR_URL_FALLBACK;
