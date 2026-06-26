import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export default function Modal({ isOpen, onClose, title, children, wide }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="case-modal-backdrop" onClick={onClose}>
      <div
        className={`case-modal${wide ? ' seller-info-modal' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="case-modal-header">
          <div className="case-modal-icon blue">
            <span className="ui-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg></span>
          </div>
          <div className="case-modal-title">
            <h2>{title}</h2>
          </div>
          <button className="ghost-button" onClick={onClose}>Cerrar</button>
        </div>
        <div className="case-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
