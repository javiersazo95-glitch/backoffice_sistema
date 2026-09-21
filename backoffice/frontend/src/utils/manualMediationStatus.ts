import { MediationStatus } from '@/types/mediation';

/**
 * Estado de mediacion tal como debe mostrarse en pantalla.
 *
 * Hoy es la identidad: ya no existe la etapa previa "En disputa" y el unico estado activo es
 * EN_MEDIACION. Se conserva como punto unico de traduccion por si vuelve a haber diferencia
 * entre el estado que guarda el backend y el que ve el operador.
 *
 * Aqui vivia ademas un mecanismo de overrides manuales guardado en localStorage
 * (repuestop.manual-mediation-status-overrides y repuestop.manual-mediation-admin-mode). Se
 * retiro: no tenia ninguna via de activacion en la interfaz --solo se encendia editando
 * localStorage a mano-- y permitia que el listado de vendedores mostrara un estado de mediacion
 * distinto del real, que es justo el dato sobre el que se decide suspender a un vendedor.
 */
export function normalizeVisibleMediationStatus(status: MediationStatus, _mediationStarted?: boolean): MediationStatus {
  return status;
}
