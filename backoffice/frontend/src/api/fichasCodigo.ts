import apiClient from './client';
import type {
  AliasPagina,
  AliasResultado,
  AliasTipo,
  CodigoSinFicha,
  FichaCorreccion,
  FichaFiltro,
  FichaManual,
  FichaPagina,
  FichaResultado,
  FichaDetalle,
  FichaUso,
  OpcionCatalogo,
  SubcategoriaOpcion,
} from '@/types/fichaCodigo';

// Soporte de las fichas por codigo del fabricante (FichaCodigoBackofficeController). Cada cambio queda en la bitacora.

const BASE = '/fichas-codigo';

export async function getFichas(params: { filtro: FichaFiltro; q?: string; masUsadas?: boolean; page: number; size: number }): Promise<FichaPagina> {
  const response = await apiClient.get<FichaPagina>(BASE, { params });
  return response.data;
}

export async function getFicha(id: number): Promise<FichaDetalle> {
  const response = await apiClient.get<FichaDetalle>(`${BASE}/${id}`);
  return response.data;
}

export async function verificarFicha(id: number, avisar: boolean): Promise<FichaResultado> {
  const response = await apiClient.post<FichaResultado>(`${BASE}/${id}/verificar`, { avisar });
  return response.data;
}

export async function rechazarFicha(id: number, motivo: string): Promise<FichaResultado> {
  const response = await apiClient.post<FichaResultado>(`${BASE}/${id}/rechazar`, { motivo });
  return response.data;
}

export async function restaurarFicha(id: number): Promise<FichaResultado> {
  const response = await apiClient.post<FichaResultado>(`${BASE}/${id}/restaurar`);
  return response.data;
}

export async function corregirFicha(id: number, correccion: FichaCorreccion): Promise<FichaResultado> {
  const response = await apiClient.put<FichaResultado>(`${BASE}/${id}`, correccion);
  return response.data;
}

/** Avisa a las tiendas cuya publicacion difiere de la ficha. No les cambia nada. */
export async function avisarTiendas(id: number): Promise<FichaResultado> {
  const response = await apiClient.post<FichaResultado>(`${BASE}/${id}/avisar`);
  return response.data;
}

export async function crearFichaManual(ficha: FichaManual): Promise<FichaResultado> {
  const response = await apiClient.post<FichaResultado>(`${BASE}/manual`, ficha);
  return response.data;
}

export async function getEquivalencias(params: { tipo: AliasTipo; pendientes: boolean; q?: string; page: number; size: number }): Promise<AliasPagina> {
  const response = await apiClient.get<AliasPagina>(`${BASE}/equivalencias`, { params });
  return response.data;
}

/** Con {@code destinoId} null se quita la equivalencia. Rehace las fichas sin verificar que dependian de ella. */
export async function resolverEquivalencia(id: number, destinoId: number | null): Promise<AliasResultado> {
  const response = await apiClient.put<AliasResultado>(`${BASE}/equivalencias/${id}`, { destinoId });
  return response.data;
}

export async function getCodigosSinFicha(limite = 50): Promise<CodigoSinFicha[]> {
  const response = await apiClient.get<CodigoSinFicha[]>(`${BASE}/sin-ficha`, { params: { limite } });
  return response.data;
}

export async function getUsoFichas(): Promise<FichaUso> {
  const response = await apiClient.get<FichaUso>(`${BASE}/uso`);
  return response.data;
}

// Catalogos publicos del inventario, para elegir categoria, marca y modelo.
export async function getSubcategorias(): Promise<SubcategoriaOpcion[]> {
  const response = await apiClient.get<SubcategoriaOpcion[]>('/catalogos/inventario/subcategorias-repuesto');
  return response.data;
}

export async function getMarcasVehiculo(): Promise<OpcionCatalogo[]> {
  const response = await apiClient.get<OpcionCatalogo[]>('/catalogos/inventario/marcas-vehiculo');
  return response.data;
}

export async function getModelosVehiculo(marcaId: number): Promise<OpcionCatalogo[]> {
  const response = await apiClient.get<OpcionCatalogo[]>(`/catalogos/inventario/marcas-vehiculo/${marcaId}/modelos`);
  return response.data;
}
