/**
 * Utilidades para formatear números de teléfono chilenos (+56 9 XXXX XXXX).
 */

export function cleanPhoneDigits(raw: string): string {
  // Elimina cualquier carácter que no sea número
  let digits = raw.replace(/\D/g, '');
  // Si empieza con 56 y tiene más de 9 dígitos, quitamos el 56 inicial
  if (digits.startsWith('56') && digits.length > 9) {
    digits = digits.slice(2);
  }
  // Limitar a 9 dígitos (formato móvil estándar en Chile)
  return digits.slice(0, 9);
}

/**
 * Formatea el número ingresado para mostrar:
 * "9 1234 5678"
 */
export function formatChileanPhone(raw: string): string {
  const digits = cleanPhoneDigits(raw);
  if (!digits) return '';

  if (digits.length <= 1) {
    return digits;
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 1)} ${digits.slice(1)}`;
  }
  return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;
}

/**
 * Devuelve el número en formato internacional para enviar al backend:
 * "+56912345678" o "+56 9 1234 5678"
 */
export function toInternationalChileanPhone(raw: string): string {
  const digits = cleanPhoneDigits(raw);
  if (!digits) return '';
  return `+56${digits}`;
}
