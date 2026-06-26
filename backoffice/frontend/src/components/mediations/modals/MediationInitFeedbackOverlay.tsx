import UiIcon from '@/components/shared/UiIcon';

type InitFeedbackStatus = 'loading' | 'success' | 'error';

interface MediationInitFeedbackOverlayProps {
  isOpen: boolean;
  label?: string;
  onClose?: () => void;
  message: string;
  status: InitFeedbackStatus;
  title: string;
}

const statusConfig: Record<InitFeedbackStatus, { icon: string; label: string }> = {
  loading: { icon: 'scale', label: 'Inicializando mediación' },
  success: { icon: 'check', label: 'Mediación inicializada' },
  error: { icon: 'alert', label: 'No se pudo iniciar' },
};

export default function MediationInitFeedbackOverlay({
  isOpen,
  label,
  onClose,
  message,
  status,
  title,
}: MediationInitFeedbackOverlayProps) {
  if (!isOpen) return null;

  const config = statusConfig[status];
  const dismissible = status !== 'loading' && !!onClose;

  return (
    <div
      className={`mediation-feedback-backdrop ${status}`}
      onClick={dismissible ? onClose : undefined}
      role="presentation"
    >
      <div
        className={`mediation-feedback-card ${status}`}
        aria-live="assertive"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mediation-feedback-badge">
          {status === 'loading' ? <span className="mediation-feedback-ring" /> : null}
          <span className="mediation-feedback-icon">
            <UiIcon name={config.icon} />
          </span>
        </div>

        <div className="mediation-feedback-copy">
          <span className="mediation-feedback-kicker">{label ?? config.label}</span>
          <h3>{title}</h3>
          <p>{message}</p>
        </div>

        {dismissible ? (
          <button className="ghost-button" type="button" onClick={onClose}>
            Cerrar
          </button>
        ) : (
          <div className="mediation-feedback-spinner" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
