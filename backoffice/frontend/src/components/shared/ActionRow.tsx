import UiIcon from './UiIcon';

interface ActionRowProps {
  icon: string;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'success' | 'danger' | 'mediation-violet' | 'emphasis';
  rightIcon?: string;
  disabled?: boolean;
}

export default function ActionRow({ icon, children, onClick, variant = 'default', rightIcon = 'arrowRight', disabled = false }: ActionRowProps) {
  const variantClasses = {
    default: '',
    success: 'success',
    danger: 'danger',
    'mediation-violet': 'mediation-state-violet',
    emphasis: 'emphasis-action',
  };

  return (
    <button
      className={`action-row ${variantClasses[variant]}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span><UiIcon name={icon} /></span>
      <span>{children}</span>
      <b><UiIcon name={disabled ? 'check' : rightIcon} /></b>
    </button>
  );
}
