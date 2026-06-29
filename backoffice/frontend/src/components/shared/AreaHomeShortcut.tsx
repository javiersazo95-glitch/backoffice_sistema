import { Link } from 'react-router-dom';
import { useState } from 'react';
import UiIcon from './UiIcon';
import HelpSupportWidget from './HelpSupportWidget';

interface AreaHomeShortcutProps {
  className?: string;
}

export default function AreaHomeShortcut({ className = '' }: AreaHomeShortcutProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className={`area-home-shortcut-group ${className}`.trim()}>
      <Link
        to="/"
        className="area-home-shortcut"
        aria-label="Volver al selector de áreas"
        title="Volver al selector de áreas"
      >
        <UiIcon name="home" />
      </Link>
      <button
        className="area-home-shortcut area-help-shortcut"
        type="button"
        aria-label="Ayuda e Incidencias"
        title="Ayuda e Incidencias"
        onClick={() => setHelpOpen((prev) => !prev)}
      >
        <UiIcon name="help" />
      </button>
      <HelpSupportWidget isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
