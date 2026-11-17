import type { ResumenTiendaAcceso } from '@/api/accesoAsistido';
import { tiempoCorto } from '@/hooks/useAccesoAsistido';

export interface IconoAcceso {
  clase: 'neutro' | 'espera' | 'pedido' | 'activo';
  titulo: string;
  /** Punto que pulsa: el vendedor pidió ayuda y soporte aún no responde. */
  pulsa: boolean;
  /** Tiempo que queda de acceso activo (corto, sin segundos). */
  tiempo: string;
}

/** Cómo se ve el icono de "Ayuda con la carga" en la fila de una tienda según su solicitud viva. */
export function iconoDeAcceso(resumen: ResumenTiendaAcceso | undefined, ahora = Date.now()): IconoAcceso {
  switch (resumen?.estado) {
    case 'PENDIENTE_VENDEDOR':
      return { clase: 'espera', titulo: 'Esperando que el vendedor autorice el acceso a su panel', pulsa: false, tiempo: '' };
    case 'PENDIENTE_SOPORTE':
      return { clase: 'pedido', titulo: 'El vendedor pidió ayuda con la carga: revisar solicitud', pulsa: true, tiempo: '' };
    case 'ACTIVO':
      return { clase: 'activo', titulo: 'Acceso al panel activo', pulsa: false, tiempo: tiempoCorto(resumen.expiraEn, ahora) };
    default:
      return { clase: 'neutro', titulo: 'Ayuda con la carga: pedir acceso al panel del vendedor', pulsa: false, tiempo: '' };
  }
}
