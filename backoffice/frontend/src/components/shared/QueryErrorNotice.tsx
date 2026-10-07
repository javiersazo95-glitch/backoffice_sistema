import { isAxiosError } from 'axios';
import UiIcon from './UiIcon';

interface QueryErrorNoticeProps {
  error: unknown;
  /** Que se intentaba cargar, en minusculas y con articulo: "las alertas". */
  what: string;
  onRetry?: () => unknown;
}

/**
 * Aviso de carga fallida para una pantalla.
 *
 * Existe porque la mayoria de las paginas solo miraban `isLoading`: un 403 o un 500 se veia
 * igual que una lista vacia ("Sin alertas", "No hay retiros") y el operador no tenia como saber
 * que faltaban datos. El interceptor de `apiClient` solo trata el 401.
 */
export default function QueryErrorNotice({ error, what, onRetry }: QueryErrorNoticeProps) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const detail = status === 403
    ? 'No tienes permiso para ver esta información.'
    : status
      ? `El servidor respondió ${status}.`
      : 'No hubo respuesta del servidor.';
  return (
    <div className="notice notice-error" role="alert">
      <p><UiIcon name="alert" /> No se pudieron cargar {what}. {detail}</p>
      {onRetry && (
        <button type="button" className="ghost-button" onClick={() => void onRetry()}>Reintentar</button>
      )}
    </div>
  );
}
