/**
 * Utilidades para formatear y validar el Rol Único Tributario (RUT) de Chile.
 */

export function cleanRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Formatea un RUT en tiempo real conforme el usuario escribe:
 * Ejemplos:
 * "1" -> "1"
 * "12" -> "1-2"
 * "123" -> "12-3"
 * "1234" -> "123-4"
 * "12345" -> "1.234-5"
 * "123456" -> "12.345-6"
 * "1234567" -> "123.456-7"
 * "12345678" -> "1.234.567-8"
 * "123456789" -> "12.345.678-9"
 * "12345678K" -> "12.345.678-K"
 */
export function formatRut(raw: string): string {
  const cleaned = cleanRut(raw);
  if (!cleaned) return '';
  if (cleaned.length === 1) return cleaned;

  // El último dígito es el dígito verificador (DV)
  const dv = cleaned.slice(-1);
  const rutDigits = cleaned.slice(0, -1);

  // Limitar cuerpo a máx 8 dígitos
  const body = rutDigits.slice(0, 8);

  // Insertar puntos de miles de derecha a izquierda
  let formattedBody = '';
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    const char = body.charAt(i);
    formattedBody = char + formattedBody;
    count++;
    if (count % 3 === 0 && i !== 0) {
      formattedBody = '.' + formattedBody;
    }
  }

  return `${formattedBody}-${dv}`;
}

/**
 * Valida un RUT usando el algoritmo oficial de Módulo 11.
 */
export function validateRut(rut: string): boolean {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 8 || cleaned.length > 9) return false;

  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    const char = body.charAt(i);
    const digit = parseInt(char, 10);
    if (isNaN(digit)) return false;
    sum += digit * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  let expectedDv = '';
  if (remainder === 11) expectedDv = '0';
  else if (remainder === 10) expectedDv = 'K';
  else expectedDv = String(remainder);

  return dv === expectedDv;
}
