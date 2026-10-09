import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as validationsApi from '@/api/validations';
import type { RegisterSellerTaxStatusPayload } from '@/api/validations';
import { mensajeDeError } from '@/api/client';
import UiIcon from '@/components/shared/UiIcon';

/**
 * Verificacion tributaria del alta, en la misma pagina en que se aprueba la tienda.
 *
 * Al contratar, la Res. SII 168 de 2025 (resolutivo 2°) exige el certificado de cumplimiento: el
 * revisor abre el PDF que subio la tienda y registra el estado y la fecha que muestra. El
 * certificado no dice si el inicio de actividades sigue vigente (Res. 99), asi que eso se marca
 * tras consultar el RUT en sii.cl. Queda como via "Certificado", con el PDF de la tienda como
 * evidencia.
 *
 * Tres pasos en el orden en que se trabaja; el tercero resume lo que se va a registrar y que
 * significa para la aprobacion, para que nada se guarde sin haberlo leido (9-oct).
 */

// Consulta de situacion tributaria de terceros del SII, sin clave (verificada el 2026-10-09:
// responde 200 con el titulo "Consultar Situación Tributaria De Terceros").
const SII_CONSULTA_TERCEROS = 'https://www2.sii.cl/stc/noauthz';
const DIAS_CERTIFICADO_RECIENTE = 30;

type EstadoCertificado = RegisterSellerTaxStatusPayload['certificadoEstado'];
type EstadoInicio = RegisterSellerTaxStatusPayload['inicioActividades'];

function hoyChile(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}

/** "2026-S2" para una fecha "YYYY-MM-DD". Mismo criterio que el backend. */
function semestreDe(fecha: string): string {
  const [anio = 0, mes = 1] = fecha.split('-').map(Number);
  return `${anio}-S${mes <= 6 ? 1 : 2}`;
}

function diasDesde(fecha: string): number {
  return Math.floor((new Date(`${hoyChile()}T00:00:00`).getTime() - new Date(`${fecha}T00:00:00`).getTime()) / 86_400_000);
}

function fechaLegible(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

const INICIO_TEXTO: Record<EstadoInicio, string> = {
  VIGENTE: 'inicio de actividades vigente',
  TERMINO_GIRO: 'con término de giro',
  SIN_INICIO: 'sin inicio de actividades',
};

interface Props {
  sellerId: number;
  rut: string;
  semestreActual: string;
  /** Abre el certificado que subio la tienda; sin el, el paso 1 remite a Documentos requeridos. */
  onAbrirCertificado?: () => void;
  /** Avisa que se registro; `aprobable` dice si con ese resultado la tienda se puede aprobar. */
  onRegistered?: (aprobable: boolean) => void;
}

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 10, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
      <span style={{
        width: 24, height: 24, borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
      }}>{numero}</span>
      <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        <strong style={{ fontSize: 14, color: '#172741' }}>{titulo}</strong>
        {children}
      </div>
    </div>
  );
}

const fila: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' };
const ayuda: CSSProperties = { fontSize: 13, color: '#475569' };

function opcion(activa: boolean): CSSProperties {
  return {
    padding: '7px 12px',
    borderRadius: 8,
    border: `1px solid ${activa ? '#2563eb' : '#cbd5e1'}`,
    background: activa ? '#eff6ff' : '#fff',
    color: activa ? '#1d4ed8' : '#334155',
    fontWeight: activa ? 600 : 500,
    fontSize: 13,
    cursor: 'pointer',
  };
}

const accion: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
  border: '1px solid #cbd5e1', background: '#fff', color: '#0b63f3', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', textDecoration: 'none',
};

export default function VerificacionAltaSii({ sellerId, rut, semestreActual, onAbrirCertificado, onRegistered }: Props) {
  const queryClient = useQueryClient();
  const [certificadoEstado, setCertificadoEstado] = useState<EstadoCertificado | ''>('');
  const [certificadoFecha, setCertificadoFecha] = useState('');
  const [inicioActividades, setInicioActividades] = useState<EstadoInicio | ''>('');
  const [conObservacion, setConObservacion] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [rutCopiado, setRutCopiado] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: RegisterSellerTaxStatusPayload) => validationsApi.registerSellerTaxStatus(sellerId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['validation-tax-status', sellerId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-tax-status'] });
      onRegistered?.(!sinInicioVigente && !deOtroSemestre);
    },
    onError: (err) => setError(mensajeDeError(err, 'No se pudo registrar la verificación.')),
  });

  const deOtroSemestre = Boolean(certificadoFecha) && semestreDe(certificadoFecha) !== semestreActual;
  const antiguo = Boolean(certificadoFecha) && !deOtroSemestre && diasDesde(certificadoFecha) > DIAS_CERTIFICADO_RECIENTE;
  const sinInicioVigente = inicioActividades === 'TERMINO_GIRO' || inicioActividades === 'SIN_INICIO';
  const completo = Boolean(certificadoEstado && certificadoFecha && inicioActividades);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const faltantes = [
      !certificadoEstado && 'lo que dice el certificado (Cumple o No cumple)',
      !certificadoFecha && 'la fecha del certificado',
      !inicioActividades && 'el estado del inicio de actividades en sii.cl',
    ].filter(Boolean);
    if (faltantes.length > 0) {
      setError(`Falta: ${faltantes.join(', ')}.`);
      return;
    }
    setError('');
    mutation.mutate({
      certificadoEstado: certificadoEstado as EstadoCertificado,
      certificadoFecha,
      inicioActividades: inicioActividades as EstadoInicio,
      inicioActividadesFecha: null,
      observaciones: conObservacion && observaciones.trim() ? observaciones.trim() : null,
    });
  }

  async function copiarRut(): Promise<void> {
    try {
      await navigator.clipboard.writeText(rut);
      setRutCopiado(true);
      window.setTimeout(() => setRutCopiado(false), 2000);
    } catch {
      /* sin portapapeles: el RUT esta a la vista */
    }
  }

  // Lo que se va a registrar, en una frase, y que significa para la aprobacion.
  let resumen: { tono: 'ok' | 'aviso' | 'bloquea'; texto: string } | null = null;
  if (completo) {
    const base = `${certificadoEstado === 'CUMPLE' ? 'Cumple' : 'No cumple'}, certificado del ${fechaLegible(certificadoFecha)}, ${INICIO_TEXTO[inicioActividades as EstadoInicio]}.`;
    if (sinInicioVigente) {
      resumen = { tono: 'bloquea', texto: `${base} Con esto la tienda no se puede aprobar (art. 68 del Código Tributario).` };
    } else if (deOtroSemestre) {
      resumen = { tono: 'bloquea', texto: `${base} El certificado es de otro semestre: no sirve para aprobar. Pide uno nuevo con una corrección.` };
    } else if (certificadoEstado === 'NO_CUMPLE') {
      resumen = { tono: 'aviso', texto: `${base} Se podrá aprobar: puede vender, y RepuesTop deberá anticipar parte del IVA cuando el SII lo reglamente.` };
    } else {
      resumen = { tono: 'ok', texto: `${base} Con esto se podrá aprobar la tienda.` };
    }
  }
  const colores = {
    ok: { background: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
    aviso: { background: '#fffbeb', color: '#92400e', border: '#fcd34d' },
    bloquea: { background: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 12, display: 'grid', gap: 12 }}>
      <strong style={{ fontSize: 14 }}>Registrar la verificación del alta</strong>

      <Paso numero={1} titulo="Certificado de cumplimiento">
        <span style={ayuda}>Revisa que el RUT y el nombre sean los de la tienda.</span>
        <div style={fila}>
          {onAbrirCertificado ? (
            <button type="button" style={accion} onClick={onAbrirCertificado}>
              <UiIcon name="eye" /> Abrir certificado
            </button>
          ) : (
            <span style={ayuda}>Está en <em>Documentos requeridos</em>.</span>
          )}
          <span style={ayuda}>Dice</span>
          <button type="button" style={opcion(certificadoEstado === 'CUMPLE')} onClick={() => setCertificadoEstado('CUMPLE')}>Cumple</button>
          <button type="button" style={opcion(certificadoEstado === 'NO_CUMPLE')} onClick={() => setCertificadoEstado('NO_CUMPLE')}>No cumple</button>
          <label style={{ ...fila, ...ayuda, gap: 6 }}>
            Fecha
            <input className="input" type="date" max={hoyChile()} value={certificadoFecha} style={{ width: 'auto' }}
              onChange={(event) => setCertificadoFecha(event.target.value)} />
          </label>
        </div>
        {deOtroSemestre && (
          <small style={{ color: '#b91c1c' }}>
            Es de otro semestre: el SII actualiza el estado en enero y julio. Pide uno nuevo con una corrección.
          </small>
        )}
        {antiguo && (
          <small style={{ color: '#b45309' }}>
            Tiene más de {DIAS_CERTIFICADO_RECIENTE} días. Sirve para este semestre, pero conviene uno reciente.
          </small>
        )}
      </Paso>

      <Paso numero={2} titulo="Inicio de actividades en sii.cl">
        <span style={ayuda}>El certificado no dice si sigue vigente: consulta el RUT en el SII.</span>
        <div style={fila}>
          <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{rut}</strong>
          <button type="button" style={accion} onClick={() => void copiarRut()}>
            <UiIcon name={rutCopiado ? 'check' : 'clipboard'} /> {rutCopiado ? 'Copiado' : 'Copiar RUT'}
          </button>
          <a href={SII_CONSULTA_TERCEROS} target="_blank" rel="noopener noreferrer" style={accion}>
            <UiIcon name="arrowRight" /> Abrir sii.cl
          </a>
        </div>
        <div style={fila}>
          <button type="button" style={opcion(inicioActividades === 'VIGENTE')} onClick={() => setInicioActividades('VIGENTE')}>Vigente</button>
          <button type="button" style={opcion(inicioActividades === 'TERMINO_GIRO')} onClick={() => setInicioActividades('TERMINO_GIRO')}>Término de giro</button>
          <button type="button" style={opcion(inicioActividades === 'SIN_INICIO')} onClick={() => setInicioActividades('SIN_INICIO')}>Sin inicio de actividades</button>
        </div>
      </Paso>

      <Paso numero={3} titulo="Revisa y registra">
        {resumen ? (
          <div style={{
            fontSize: 13, lineHeight: 1.5, padding: '8px 12px', borderRadius: 8,
            background: colores[resumen.tono].background, color: colores[resumen.tono].color,
            border: `1px solid ${colores[resumen.tono].border}`,
          }}>
            {resumen.texto}
          </div>
        ) : (
          <span style={ayuda}>Completa los pasos 1 y 2 para ver lo que se va a registrar.</span>
        )}

        {conObservacion ? (
          <label style={{ display: 'grid', gap: 4, ...ayuda }}>
            Observación (opcional)
            <input className="input" type="text" maxLength={500} value={observaciones} autoFocus
              onChange={(event) => setObservaciones(event.target.value)} />
          </label>
        ) : (
          <button type="button" onClick={() => setConObservacion(true)}
            style={{ justifySelf: 'start', border: 0, background: 'transparent', color: '#0b63f3', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            + Agregar observación
          </button>
        )}

        {error && <p className="validation-decision-hint" style={{ color: '#b91c1c', margin: 0 }}><UiIcon name="alert" /> {error}</p>}

        <div>
          <button className="validation-action-button approve" type="submit" disabled={mutation.isPending}>
            <UiIcon name="fileCheck" />
            {mutation.isPending ? 'Registrando…' : 'Registrar verificación'}
          </button>
        </div>
      </Paso>
    </form>
  );
}
