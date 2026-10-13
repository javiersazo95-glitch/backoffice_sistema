import { useEffect, useRef, useState, type ReactNode } from 'react';
import UiIcon from '@/components/shared/UiIcon';

/**
 * Copia al portapapeles con respaldo para navegadores sin `navigator.clipboard` (http sin TLS en
 * la red local, por ejemplo). Devuelve si se pudo copiar.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Se intenta el respaldo.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Estado "Copiado" que vuelve solo a los 1,5 s. */
export function useCopied(): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const copy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  };
  return [copied, copy];
}

export function CopyButton({
  text,
  label,
  title = 'Copiar',
  className = '',
}: {
  text: string;
  label?: string;
  title?: string;
  className?: string;
}) {
  const [copied, copy] = useCopied();
  return (
    <button
      type="button"
      className={`pp-copy-button${copied ? ' is-copied' : ''} ${className}`.trim()}
      onClick={() => void copy(text)}
      title={copied ? 'Copiado' : title}
      aria-label={copied ? 'Copiado' : title}
      disabled={!text}
    >
      <UiIcon name={copied ? 'check' : 'clipboard'} />
      {label !== undefined && <span>{copied ? 'Copiado' : label}</span>}
    </button>
  );
}

/**
 * Una fila "etiqueta / valor / copiar" de la ficha de transferencia. Lo que se copia es el valor
 * crudo (`copyValue`: cuenta sin puntos, monto sin "$"); lo que se ve puede ir formateado. Asi el
 * operador pega exactamente lo que el banco espera y no hay espacio para tipear.
 */
export default function CopyField({
  label,
  value,
  copyValue,
  hint,
  mono = true,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  copyValue: string | null | undefined;
  hint?: ReactNode;
  mono?: boolean;
  emphasis?: boolean;
}) {
  const [copied, copy] = useCopied();
  const empty = !copyValue;
  return (
    <div
      className={`pp-copy-field${copied ? ' is-copied' : ''}${empty ? ' is-empty' : ''}${emphasis ? ' is-emphasis' : ''}`}
      onClick={() => { if (!empty) void copy(copyValue); }}
      role={empty ? undefined : 'button'}
      tabIndex={empty ? undefined : 0}
      onKeyDown={(event) => {
        if (!empty && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void copy(copyValue); }
      }}
      title={empty ? undefined : 'Clic para copiar'}
    >
      <div className="pp-copy-field-text">
        <span className="pp-copy-field-label">{label}</span>
        <span className={`pp-copy-field-value${mono ? ' is-mono' : ''}`}>{empty ? <em>Sin registrar</em> : value}</span>
        {hint && <span className="pp-copy-field-hint">{hint}</span>}
      </div>
      <span className="pp-copy-field-action" aria-hidden="true">
        <UiIcon name={copied ? 'check' : 'clipboard'} />
        {copied ? 'Copiado' : 'Copiar'}
      </span>
    </div>
  );
}
