import { useMemo, useSyncExternalStore } from 'react';
import { remoteConfig, type RemoteConfigSnapshot } from '@/utils/remoteConfigStore';
import type { CatalogoDe, CatalogoNombre, OpcionListaDTO } from '@/types/remoteConfig';
import { getComisiones, getBancosBci, getTipoCuentaOptions } from '@/modules/administration/constants';

/**
 * Hooks del módulo `remoteConfig` (contrato del Mantenedor común, sección 6).
 *
 * Todos leen el store con `useSyncExternalStore`, así que el componente se vuelve a pintar
 * cuando llega un bootstrap nuevo y, mientras no llegue (o si el backend todavía no lo expone),
 * devuelven el fallback: el backoffice se ve exactamente igual que antes del mantenedor.
 *
 * No necesitan `RemoteConfigProvider` para funcionar (sin él solo no hay carga desde la red), lo
 * que facilita montar componentes sueltos en pruebas.
 */

/** Snapshot completo; útil para decidir si ya hay config de red o seguimos con fallbacks. */
export function useRemoteConfigSnapshot(): RemoteConfigSnapshot {
  return useSyncExternalStore(remoteConfig.subscribe, remoteConfig.get, remoteConfig.get);
}

/** Feature flag ya resuelto para BACKOFFICE. Ausente en el bootstrap = `fallback` (por convención `true`). */
export function useFlag(clave: string, fallback = true): boolean {
  useRemoteConfigSnapshot();
  return remoteConfig.getFlag(clave, fallback);
}

/** Metadata del flag (p. ej. `{mensaje}` de `global.mantenimiento`), o `null`. */
export function useFlagMetadata(clave: string): Record<string, unknown> | null {
  useRemoteConfigSnapshot();
  return remoteConfig.getFlagMetadata(clave);
}

/**
 * Opciones activas de una lista desplegable. Devuelve la misma referencia mientras el bootstrap
 * no cambie, así puede ir en dependencias de `useMemo`/`useEffect` sin provocar bucles.
 */
export function useLista(codigo: string, fallback?: OpcionListaDTO[]): OpcionListaDTO[] {
  useRemoteConfigSnapshot();
  return remoteConfig.getLista(codigo, fallback);
}

/** Parámetro público parseado según `parametrosTipos`; si falta o no calza con el tipo del fallback, el fallback. */
export function useParametro<T extends number | string | boolean>(clave: string, fallback: T): T {
  useRemoteConfigSnapshot();
  return remoteConfig.getParametro(clave, fallback);
}

/** Catálogo del bootstrap (`categorias`, `marcasVehiculo`, `marcasRepuestoDestacadas`). */
export function useCatalogo<N extends CatalogoNombre>(nombre: N, fallback?: CatalogoDe<N>): CatalogoDe<N> {
  useRemoteConfigSnapshot();
  return remoteConfig.getCatalogo(nombre, fallback);
}

/* ------------------------------------------------------------------ */
/* Azúcar para Administración Contable                                 */
/* ------------------------------------------------------------------ */

/**
 * Tasas de comisión y pasarela vigentes (parámetros `comision.*` y `pasarela.*`), con los valores
 * históricos de `modules/administration/constants` como fallback. La referencia es estable por
 * snapshot, así que puede usarse en dependencias.
 */
export function useComisiones() {
  const snapshot = useRemoteConfigSnapshot();
  return useMemo(() => getComisiones(), [snapshot]);
}

/** Bancos para el selector de datos bancarios: lista `BANCO` del mantenedor o la nómina BCI local. */
export function useBancosBci() {
  const snapshot = useRemoteConfigSnapshot();
  return useMemo(() => getBancosBci(), [snapshot]);
}

/** Tipos de cuenta bancaria: lista `TIPO_CUENTA_BANCARIA` o las tres opciones de siempre. */
export function useTipoCuentaOptions() {
  const snapshot = useRemoteConfigSnapshot();
  return useMemo(() => getTipoCuentaOptions(), [snapshot]);
}
