import UiIcon from './UiIcon';

interface NoticeProps {
  children: React.ReactNode;
  onDismiss?: () => void;
}

export default function Notice({ children, onDismiss }: NoticeProps) {
  return (
    <div className="notice">
      <p>
        <UiIcon name="shield" /> {children}
      </p>
      {onDismiss && (
        <button
          className="ghost-button icon-only"
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
        >
          <UiIcon name="close" />
        </button>
      )}
    </div>
  );
}
