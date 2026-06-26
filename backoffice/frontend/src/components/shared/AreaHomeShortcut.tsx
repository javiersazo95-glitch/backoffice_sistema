import { Link } from 'react-router-dom';
import UiIcon from './UiIcon';

interface AreaHomeShortcutProps {
  className?: string;
}

export default function AreaHomeShortcut({ className = '' }: AreaHomeShortcutProps) {
  return (
    <Link
      to="/"
      className={`area-home-shortcut ${className}`.trim()}
      aria-label="Volver al selector de áreas"
      title="Volver al selector de áreas"
    >
      <UiIcon name="home" />
    </Link>
  );
}
