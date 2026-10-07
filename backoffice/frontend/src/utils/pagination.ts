import type { PageResponse } from '@/types/common';

/**
 * Trae TODAS las paginas de un listado paginado del backend y las devuelve como una sola.
 *
 * Varias pantallas calculan cosas sobre el listado completo (filtros en memoria, contadores,
 * selectores de tienda, cruces entre mediaciones y vendedores) y pedian `size: 100` una sola
 * vez: desde el registro 101 en adelante, simplemente no existia. Hasta que esas pantallas
 * paginen de verdad en el servidor, esto recorre las paginas que haga falta (en paralelo tras
 * la primera, que es la que dice cuantas hay) y conserva `totalElements` del backend.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, size: number) => Promise<PageResponse<T>>,
  size = 100,
  maxPages = 50,
): Promise<PageResponse<T>> {
  const first = await fetchPage(0, size);
  const totalPages = Math.min(first.totalPages ?? 1, maxPages);
  if (totalPages <= 1) return first;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 1, size)),
  );
  const content = [first, ...rest].flatMap((page) => page.content);
  return { ...first, content, currentPage: 0, pageSize: content.length, totalPages: 1 };
}
