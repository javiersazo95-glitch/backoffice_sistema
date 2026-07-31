import ExcelJS from 'exceljs';
import type { RetiroAdminResponse, Withdrawal } from './types';

// BCI-NOMINA-001: replica exacta (columnas, colores, hojas) de la plantilla
// "Nomina_Pago_en_Linea.xlsx" de BCI, leida con openpyxl para capturar estilos y
// contenido verbatim. No derivar de otros catalogos (ej. el enum del backend) para no
// perder fidelidad con el archivo original.

const RED_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
const ORANGE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11 };

const HOJA1_HEADERS: { text: string; width: number; fill?: ExcelJS.Fill }[] = [
  { text: 'Nº Cuenta de Cargo', width: 18.453125, fill: RED_FILL },
  { text: 'Nº Cuenta de Destino', width: 20.1796875, fill: RED_FILL },
  { text: 'Banco Destino', width: 13.54296875, fill: RED_FILL },
  { text: 'Rut Beneficiario', width: 15.1796875, fill: RED_FILL },
  { text: 'Dig. Verif. Beneficiario', width: 10.453125, fill: RED_FILL },
  { text: 'Nombre Beneficiario', width: 41.54296875, fill: RED_FILL },
  { text: 'Monto Transferencia', width: 19.453125, fill: RED_FILL },
  { text: 'Nro.Factura Boleta (1)', width: 20.453125 },
  { text: 'Nº Orden de Compra(1)', width: 22.0 },
  { text: 'Tipo de Pago(2)', width: 14.54296875, fill: RED_FILL },
  { text: 'Mensaje Destinatario (3)', width: 23.0 },
  { text: 'Email Destinatario(3)', width: 19.54296875 },
  { text: 'Cuenta Destino inscrita como(4)', width: 29.54296875, fill: ORANGE_FILL },
];

// Tabla de bancos del archivo original, en el mismo orden (no alfabetico/numerico).
// [codigo, descripcion, notaC, notaD] — notaC/notaD son leyendas embebidas por BCI en
// filas puntuales de esta misma tabla (ej. fila 17 explica que "Rojo" = "Obligatorio"),
// no datos propios de ese banco. Se conservan tal cual para replicar el archivo.
const COD_BANCO_ROWS: [number, string, string | null, string | null][] = [
  [1, 'Banco de Chile / A. Edwards / Citibank N.A.', 'REM', 'Remuneraciones'],
  [9, 'Banco Internacional', 'PRV', 'Proveedores'],
  [11, 'Dresdner Bank Leteinamerika', 'OTR', 'Otros Pagos'],
  [12, 'Banco del Estado de Chile', 'DIV', 'Dividendos'],
  [14, 'Scotiabank', null, null],
  [16, 'Banco Crédito e Inversiones', null, null],
  [17, 'Banco Do Brasil S.A.', 'Rojo', 'Obligatorio'],
  [27, 'Corpbanca', 'Azul', 'Opcional'],
  [28, 'Banco Bice', 'Naranjo', 'Obligatorio solo para Cuentas nuevas'],
  [31, 'HSBC Bank Chile', null, null],
  [37, 'Banco Santander - Santiago', null, null],
  [39, 'Banco Itaú', 'Alias', 'Cuenta Destino inscrita como'],
  [41, 'JP Morgan Chase Bank', null, null],
  [43, 'Banco de la Nación Argentina', '(1) Obligatorio para pagos PRV', null],
  [45, 'The Bank of Tokyo – Mitsubishi', '(3) Obligatorio si ingresa email destinatario', null],
  [46, 'Abn Amro Bank (Chile)', null, null],
  [49, 'Banco Security', null, null],
  [51, 'Banco Falabella', null, null],
  [52, 'Deutsche Bank (Chile)', null, null],
  [53, 'Banco Ripley', null, null],
  [54, 'HNS Banco', null, null],
  [55, 'Banco Consorcio', null, null],
  [504, 'BBVA Banco Bhif', null, null],
  [507, 'Banco del Desarrollo', null, null],
  [734, 'Banco Conosur', null, null],
  [672, 'Copeeuch', null, null],
  [729, 'Tarjetas Los Heroes S.A.', null, null],
  [730, 'Tenpo Prepago S.A.', null, null],
  [732, 'Los Andes Tarjetas de Prepago', null, null],
  [116, 'Cuentas Mach', null, null],
  [875, 'Mercado Pago', null, null],
  [741, 'Copec Pay', null, null],
  [738, 'Global 66', null, null],
  [697, 'La polar', null, null],
];

// Mapeo best-effort para vendedores cuyo banco aun no tiene bankCode guardado
// (registrado antes de que existiera el catalogo con codigos).
const LEGACY_BANK_NAME_TO_CODE: Record<string, number> = {
  bancoestado: 12,
  'banco de chile': 1,
  'banco santander': 37,
  bci: 16,
  scotiabank: 14,
  'itaú': 39,
  itau: 39,
  'banco falabella': 51,
};

function legacyBankCode(bankName?: string | null): number | null {
  if (!bankName) return null;
  return LEGACY_BANK_NAME_TO_CODE[bankName.trim().toLowerCase()] ?? null;
}

function splitRutFallback(rut?: string | null): { numero: string; dv: string } | null {
  if (!rut) return null;
  const cleaned = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleaned.length <= 1) return null;
  return { numero: cleaned.slice(0, -1), dv: cleaned.slice(-1) };
}

/**
 * BO-SOCIOS-001: adapta un retiro de socio (Withdrawal) a la misma forma que
 * buildBciNominaWorkbook espera de un retiro de vendedor, para que ambos entren en la
 * misma nomina BCI. Usa siempre w.codigoRetiro (ej. "J-1") en vez del fallback
 * "RET-<retiroId>" de buildBciNominaWorkbook, porque bo_retiro y bo_retiro_socio numeran
 * sus IDs de forma independiente y podrian coincidir (ver V2026073102).
 */
export function socioToNominaRow(w: Withdrawal): RetiroAdminResponse {
  return {
    retiroId: 0,
    nombreTienda: w.beneficiary,
    rut: w.rut ?? '',
    razonSocial: w.titular ?? w.beneficiary,
    banco: w.banco ?? '',
    tipoCuenta: w.tipoCuenta ?? '',
    numeroCuenta: w.numeroCuenta ?? '',
    codigoRetiro: w.codigoRetiro ?? undefined,
    // Columna K: mensaje fijo para retiros de socio, distinto del "Pago retiro <codigo>"
    // que usan los vendedores.
    mensajeDestinatario: `Anticipo de Dividendos ${w.beneficiary}`,
    // BCI-NOMINA-002: idExterno/primeraSolicitud vienen del backend (ver
    // RetiroSocioAdminHelper.aliasPorSocio/esPrimeraSolicitud) para que el alias solo
    // aparezca en la primera solicitud de cada socio y nunca se re-inscriba una cuenta
    // que el banco ya tiene registrada.
    idExterno: w.alias ?? undefined,
    primeraSolicitud: w.primeraSolicitud ?? false,
    bankCode: w.bankCode ?? null,
    bankAccountHolderName: w.titular ?? w.beneficiary,
    bankAccountNotificationEmail: w.email ?? '',
    monto: w.amount,
    email: w.email ?? '',
    fecha: w.date,
    estado: w.estado ?? 'PENDIENTE',
    fechaEfectiva: w.fechaPago ?? '',
  };
}

export async function buildBciNominaWorkbook(
  withdrawals: RetiroAdminResponse[],
  cuentaCargoBci: string,
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();

  const hoja1 = workbook.addWorksheet('Hoja1');
  HOJA1_HEADERS.forEach((header, index) => {
    hoja1.getColumn(index + 1).width = header.width;
    const cell = hoja1.getCell(1, index + 1);
    cell.value = header.text;
    cell.font = HEADER_FONT;
    if (header.fill) cell.fill = header.fill;
  });

  withdrawals.forEach((w, i) => {
    const row = i + 2;
    const codigoRetiro = w.codigoRetiro || `RET-${String(w.retiroId).padStart(6, '0')}`;
    const rutFallback = splitRutFallback(w.rut);
    const rutNumero = w.bankAccountRutNumero || rutFallback?.numero || '';
    const rutDv = w.bankAccountRutDv || rutFallback?.dv || '';
    const bankCode = w.bankCode ?? legacyBankCode(w.banco);
    const nombreBeneficiario = w.bankAccountHolderName || w.razonSocial || '';
    const email = w.bankAccountNotificationEmail || '';
    // BCI-NOMINA-002: columna M = ID externo del vendedor (ej. "ML-1") SOLO en su primera
    // solicitud de retiro; en solicitudes posteriores queda vacia porque el banco ya tiene
    // la cuenta registrada.
    const cuentaInscritaComo = w.primeraSolicitud && w.idExterno ? w.idExterno : '';

    hoja1.getCell(row, 1).value = cuentaCargoBci;
    hoja1.getCell(row, 2).value = w.numeroCuenta;
    hoja1.getCell(row, 3).value = bankCode ?? '';
    hoja1.getCell(row, 4).value = rutNumero;
    hoja1.getCell(row, 5).value = rutDv;
    hoja1.getCell(row, 6).value = nombreBeneficiario;
    hoja1.getCell(row, 7).value = w.monto;
    hoja1.getCell(row, 8).value = codigoRetiro;
    hoja1.getCell(row, 9).value = codigoRetiro;
    // Los vendedores no son proveedores de RepuesTop (no le venden bienes/servicios a la
    // empresa, reciben su parte de ventas hechas en la plataforma) => "Otros Pagos", no "PRV".
    hoja1.getCell(row, 10).value = 'OTR';
    // BO-SOCIOS-001: un retiro de socio siempre trae mensajeDestinatario ya armado
    // ("Anticipo de Dividendos <socio>", ver socioToNominaRow) y se usa tal cual, sin
    // depender de si el socio tiene email registrado.
    hoja1.getCell(row, 11).value = w.mensajeDestinatario ?? (email ? `Pago retiro ${codigoRetiro}` : '');
    hoja1.getCell(row, 12).value = email;
    hoja1.getCell(row, 13).value = cuentaInscritaComo;
  });

  const codBanco = workbook.addWorksheet('COD_BANCO');
  codBanco.getColumn(2).width = 39.453125;
  codBanco.getColumn(4).width = 34.0;

  const titleCell = codBanco.getCell('A1');
  titleCell.value = 'Tabla de Bancos';
  titleCell.font = { bold: true, size: 10 };

  const headerCodigo = codBanco.getCell('A3');
  headerCodigo.value = 'Código';
  headerCodigo.font = { bold: true, size: 10 };

  const headerDescripcion = codBanco.getCell('B3');
  headerDescripcion.value = 'Descripción';
  headerDescripcion.font = { bold: true, size: 10 };

  COD_BANCO_ROWS.forEach(([codigo, descripcion, notaC, notaD], i) => {
    const row = i + 4;
    codBanco.getCell(row, 1).value = codigo;
    codBanco.getCell(row, 2).value = descripcion;
    if (notaC != null) codBanco.getCell(row, 3).value = notaC;
    if (notaD != null) codBanco.getCell(row, 4).value = notaD;
  });

  workbook.addWorksheet('Hoja3');

  return workbook.xlsx.writeBuffer();
}

export const BCI_NOMINA_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
