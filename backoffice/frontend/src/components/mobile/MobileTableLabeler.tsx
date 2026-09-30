import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

/**
 * Tablas de detalle (dentro de modales y fichas) que en un teléfono se muestran como tarjetas
 * apiladas. Son tablas con `table-layout: fixed` o anchos fijos pensados para escritorio: en
 * 375px sus columnas se reparten el ancho y parten las palabras letra a letra.
 */
const STACK_SELECTOR = [
  '.seller-profile-table',
  '.seller-active-mediations-table',
  '.payout-request-table',
  '.modal-table-scroll table',
  '.liquidation-preview-table',
  '.table-shell.embedded table',
  '.users-table',
  '.permissions-config-shell table',
  '.cpd-table',
  '.cbt-table',
  '.cpx-table',
  '.cap-table',
].join(', ');

function labelTable(table: HTMLTableElement) {
  const headers = Array.from(table.querySelectorAll(':scope > thead > tr:last-child > th'))
    .map((th) => (th.textContent ?? '').replace(/\s+/g, ' ').trim());
  table.classList.add('mb-stack-table');
  const rows = table.querySelectorAll(':scope > tbody > tr, :scope > tfoot > tr');
  rows.forEach((row) => {
    let column = 0;
    Array.from(row.children).forEach((cell) => {
      const span = (cell as HTMLTableCellElement).colSpan || 1;
      const label = span === 1 ? headers[column] ?? '' : '';
      if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
      if (span > 1) cell.classList.add('mb-stack-span');
      column += span;
    });
  });
}

/**
 * Solo en teléfonos: marca esas tablas y copia el texto de cada encabezado a sus celdas
 * (`data-label`), para que mobile.css las muestre como tarjetas con etiqueta. No se monta
 * nada en escritorio y el marcado de React no cambia.
 */
export default function MobileTableLabeler() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile || typeof document === 'undefined') return;
    let frame = 0;
    const run = () => {
      frame = 0;
      document.querySelectorAll<HTMLTableElement>(STACK_SELECTOR).forEach(labelTable);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(run);
    };
    run();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [isMobile]);

  return null;
}
