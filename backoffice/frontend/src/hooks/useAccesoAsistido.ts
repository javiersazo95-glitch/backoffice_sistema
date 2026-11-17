import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  aceptarSolicitudVendedor,
  cancelarAcceso,
  emitirTicketAcceso,
  getDetalleAcceso,
  getResumenAccesos,
  reenviarCorreoAcceso,
  solicitarAcceso,
  type ResumenTiendaAcceso,
} from '@/api/accesoAsistido';

const CLAVE = 'acceso-asistido';

/** Solicitudes vivas de todas las tiendas, indexadas por proveedorId; se refresca cada 30 s para pintar los iconos. */
export function useResumenAccesos(enabled = true) {
  const query = useQuery({
    queryKey: [CLAVE, 'resumen'],
    queryFn: getResumenAccesos,
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const porTienda: Record<number, ResumenTiendaAcceso> = {};
  for (const tienda of query.data?.tiendas ?? []) porTienda[tienda.proveedorId] = tienda;
  return { porTienda, serverTime: query.data?.serverTime ?? null, isLoading: query.isLoading };
}

/** Acceso vivo e historial de una tienda. Mientras hay algo pendiente se consulta cada 5 s (espera de la respuesta). */
export function useDetalleAcceso(proveedorId: number | null, activo: boolean) {
  return useQuery({
    queryKey: [CLAVE, 'detalle', proveedorId],
    queryFn: () => getDetalleAcceso(proveedorId as number),
    enabled: activo && proveedorId != null,
    refetchInterval: (consulta) => (consulta.state.data?.actual?.estado === 'PENDIENTE_VENDEDOR' ? 5_000 : 30_000),
  });
}

export function useAccionesAcceso(proveedorId: number | null) {
  const queryClient = useQueryClient();
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: [CLAVE] });
  };
  return {
    solicitar: useMutation({
      mutationFn: (datos: Parameters<typeof solicitarAcceso>[1]) => solicitarAcceso(proveedorId as number, datos),
      onSuccess: refrescar,
    }),
    reenviar: useMutation({ mutationFn: reenviarCorreoAcceso, onSuccess: refrescar }),
    cancelar: useMutation({ mutationFn: cancelarAcceso, onSuccess: refrescar }),
    aceptar: useMutation({ mutationFn: aceptarSolicitudVendedor, onSuccess: refrescar }),
    emitirTicket: useMutation({ mutationFn: emitirTicketAcceso }),
  };
}

/** Texto "hh:mm:ss" (o "2d 03:04:05") que baja cada segundo, corregido con el reloj del servidor. */
export function useCuentaRegresiva(finIso: string | null, serverTime: string | null) {
  const [offsetMs] = useState(() => (serverTime ? Date.parse(serverTime) - Date.now() : 0));
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return cuentaRegresiva(finIso, offsetMs, ahora);
}

export interface CuentaRegresiva {
  ms: number;
  vencido: boolean;
  texto: string;
  tono: 'normal' | 'ambar' | 'rojo';
}

const dos = (n: number) => String(n).padStart(2, '0');

export function cuentaRegresiva(finIso: string | null, offsetMs: number, ahora = Date.now()): CuentaRegresiva {
  const fin = finIso ? Date.parse(finIso) : NaN;
  if (Number.isNaN(fin)) return { ms: 0, vencido: true, texto: '00:00:00', tono: 'rojo' };
  const ms = Math.max(0, fin - (ahora + offsetMs));
  const total = Math.floor(ms / 1000);
  const dias = Math.floor(total / 86400);
  const hms = `${dos(Math.floor((total % 86400) / 3600))}:${dos(Math.floor((total % 3600) / 60))}:${dos(total % 60)}`;
  const tono = ms < 3_600_000 ? 'rojo' : ms < 6 * 3_600_000 ? 'ambar' : 'normal';
  return { ms, vencido: ms === 0, texto: dias > 0 ? `${dias}d ${hms}` : hms, tono };
}

/** "1 h 20 min", para el icono de la tabla (no hace falta contar segundos ahí). */
export function tiempoCorto(finIso: string | null, ahora = Date.now()): string {
  const fin = finIso ? Date.parse(finIso) : NaN;
  if (Number.isNaN(fin)) return '';
  const min = Math.max(0, Math.round((fin - ahora) / 60_000));
  // Compacto: va dentro del boton de la fila ("1h 59m", "2d", "45m").
  if (min >= 24 * 60) return `${Math.floor(min / (24 * 60))}d`;
  if (min >= 60) return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
  return `${min}m`;
}
