import { useState, useRef, useEffect } from 'react';
import UiIcon from './UiIcon';

interface PageSizeSelectorProps {
  value: number;
  onChange: (size: number) => void;
}

export default function PageSizeSelector({ value, onChange }: PageSizeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [5, 10, 25, 50];

  return (
    <div className="page-size-selector" ref={ref}>
      <button
        className="page-size-button"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Registros por página"
        title="Registros por página"
      >
        <UiIcon name="filter" />
        <span>{value}</span>
      </button>
      {isOpen && (
        <div className="page-size-dropdown">
          {options.map((opt) => (
            <button
              key={opt}
              className={`page-size-option${opt === value ? ' active' : ''}`}
              type="button"
              onClick={() => { onChange(opt); setIsOpen(false); }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
