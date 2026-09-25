/**
 * Numero publico del pedido (O72, pruebas de lanzamiento, 25-sep).
 *
 * Es el UNICO identificador que ven comprador, tienda y soporte: 10 digitos (9 aleatorios +
 * verificador Luhn), que el backend manda sin espacios ("4827193600") o ya agrupado 4-4-2
 * ("4827 1936 00"). La vista de una tienda de un pedido con varias lleva su sufijo
 * ("4827193600-2"). Espejo de `NumeroPedido.java`; ver `data/orderIdentity.js` en el Market.
 */
export const ORDER_NUMBER_LENGTH = 10;

function luhnDigit(nineDigits: string): number {
  let sum = 0;
  let double = true;
  for (let i = nineDigits.length - 1; i >= 0; i -= 1) {
    let d = Number(nineDigits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

/** `true` si el texto limpio es un numero publico valido: 10 digitos, primero distinto de 0, Luhn ok. */
export function isPublicOrderNumber(value: string | number | null | undefined): boolean {
  const numero = String(value ?? '').trim();
  if (!/^[1-9]\d{9}$/.test(numero)) return false;
  return luhnDigit(numero.slice(0, ORDER_NUMBER_LENGTH - 1)) === Number(numero[ORDER_NUMBER_LENGTH - 1]);
}

/**
 * Lo que escribio una persona ("4827 1936 00", "4827-1936-00-2") llevado al numero limpio de
 * 10 digitos, o `''` si no es un numero publico valido. El sufijo de tienda se descarta.
 */
export function normalizeOrderNumber(value: string | number | null | undefined): string {
  const limpio = String(value ?? '').trim().replace(/[\s.]/g, '');
  if (!limpio) return '';
  const match = limpio.match(/^([\d-]+?)(?:-(\d{1,2}))?$/);
  if (!match) return '';
  const digitos = (match[1] ?? '').replace(/-/g, '');
  if (isPublicOrderNumber(digitos)) return digitos;
  const todo = limpio.replace(/-/g, '');
  return isPublicOrderNumber(todo) ? todo : '';
}

/** "4827193600" -> "4827 1936 00"; "4827193600-2" -> "4827 1936 00-2". Otro texto se devuelve igual. */
export function formatOrderNumber(value: string | number | null | undefined): string {
  const texto = String(value ?? '').trim();
  const match = texto.match(/^(\d{10})(-\d{1,2})?$/);
  if (!match) return texto;
  const n = match[1] ?? '';
  return `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8)}${match[2] ?? ''}`;
}

/** Texto para BUSCAR un pedido: el numero con y sin espacios, para que se encuentre como se escriba. */
export function orderNumberSearchText(value: string | number | null | undefined): string {
  const texto = String(value ?? '').trim();
  if (!texto) return '';
  return `${texto} ${formatOrderNumber(texto)} ${texto.replace(/[\s-]/g, '')}`;
}
