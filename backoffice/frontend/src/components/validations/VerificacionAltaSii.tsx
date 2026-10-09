import { useState, type CSSProperties, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as validationsApi from '@/api/validations';
import type { RegisterSellerTaxStatusPayload } from '@/api/validations';
import { mensajeDeError } from '@/api/client';
import UiIcon from '@/components/shared/UiIcon';

/**
 * Verificacion tributaria del alta, junto al certificado y en la misma pagina en que se aprueba.
 *
 * Al contratar, la Res. SII 168 de 2025 (resolutivo 2°) exige el certificado de cumplimiento: el
 * revisor lo abre y registra lo que dice y su fecha. El certificado no dice si el inicio de
 * actividades sigue vigente (Res. 99), asi que eso se marca tras consultar el RUT en sii.cl. Queda
 * como via "Certificado", con el PDF de la tienda como evidencia.
 *
 * Formulario compacto (9-oct): "Cumple / No cumple" es una pregunta de dos opciones cortas dentro
 * de un formulario que se guarda con un boton, asi que va con radios en linea (GOV.UK); el inicio
 * de actividades tiene tres opciones y va en una lista. Una barra final resume lo que se va a
 * registrar y si con eso se podra aprobar la tienda.
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

const INICIO_TEXTO: Record<EstadoInicio, string> = {
  VIGENTE: 'inicio de actividades vigente',
  TERMINO_GIRO: 'término de giro',
  SIN_INICIO: 'sin inicio de actividades',
};

interface Props {
  sellerId: number;
  rut: string;
  semestreActual: string;
  /** Avisa que se registro; `aprobable` dice si con ese resultado la tienda se puede aprobar. */
  onRegistered?: (aprobable: boolean) => void;
}

const etiqueta: CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569' };
const campo: CSSProperties = { display: 'grid', gap: 4, minWidth: 0, alignContent: 'start' };
const enLinea: CSSProperties = { display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', minHeight: 38 };
const enlace: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8,
  border: '1px solid #cbd5e1', background: '#fff', color: '#0b63f3', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', textDecoration: 'none',
};

export default function VerificacionAltaSii({ sellerId, rut, semestreActual, onRegistered }: Props) {
  const queryClient = useQueryClient();
  const [certificadoEstado, setCertificadoEstado] = useState<EstadoCertificado | ''>('');
  const [certificadoFecha, setCertificadoFecha] = useState('');
  const [inicioActividades, setInicioActividades] = useState<EstadoInicio | ''>('');
  const [conObservacion, setConObservacion] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [rutCopiado, setRutCopiado] = useState(false);

  const deOtroSemestre = Boolean(certificadoFecha) && semestreDe(certificadoFecha) !== semestreActual;
  const antiguo = Boolean(certificadoFecha) && !deOtroSemestre && diasDesde(certificadoFecha) > DIAS_CERTIFICADO_RECIENTE;
  const sinInicioVigente = inicioActividades === 'TERMINO_GIRO' || inicioActividades === 'SIN_INICIO';

  const mutation = useMutation({
    mutationFn: (payload: RegisterSellerTaxStatusPayload) => validationsApi.registerSellerTaxStatus(sellerId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['validation-tax-status', sellerId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-tax-status'] });
      onRegistered?.(!sinInicioVigente && !deOtroSemestre);
    },
    onError: (err) => setError(mensajeDeError(err, 'No se pudo registrar la verificación.')),
  });

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const faltantes = [
      !certificadoEstado && 'lo que dice el certificado',
      !certificadoFecha && 'su fecha',
      !inicioActividades && 'el inicio de actividades en sii.cl',
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

  // Lo que se va a registrar y que significa para la aprobacion, en una linea.
  let resumen: { color: string; icono: string; texto: string };
  if (!certificadoEstado || !certificadoFecha || !inicioActividades) {
    resumen = { color: '#64748b', icono: 'info', texto: 'Completa lo que dice el certificado, su fecha y el inicio de actividades.' };
  } else {
    const base = `${certificadoEstado === 'CUMPLE' ? 'Cumple' : 'No cumple'} · ${INICIO_TEXTO[inicioActividades]}`;
    if (sinInicioVigente) {
      resumen = { color: '#b91c1c', icono: 'alert', texto: `${base}: la tienda no se puede aprobar (art. 68 del Código Tributario).` };
    } else if (deOtroSemestre) {
      resumen = { color: '#b91c1c', icono: 'alert', texto: `${base}: el certificado es de otro semestre y no sirve para aprobar. Pide uno nuevo con una corrección.` };
    } else if (certificadoEstado === 'NO_CUMPLE') {
      resumen = { color: '#b45309', icono: 'alert', texto: `${base}: se podrá aprobar. RepuesTop deberá anticipar parte del IVA cuando el SII lo reglamente.` };
    } else {
      resumen = { color: '#047857', icono: 'check', texto: `${base}: se podrá aprobar la tienda.` };
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <div className="verificacion-alta-sii-campos">
        <fieldset style={{ ...campo, border: 0, padding: 0, margin: 0 }}>
          <legend style={{ ...etiqueta, padding: 0, marginBottom: 4 }}>¿Qué dice el certificado?</legend>
          <div style={enLinea}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
              <input type="radio" name={`certificado-${sellerId}`} checked={certificadoEstado === 'CUMPLE'}
                onChange={() => setCertificadoEstado('CUMPLE')} />
              Cumple
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
              <input type="radio" name={`certificado-${sellerId}`} checked={certificadoEstado === 'NO_CUMPLE'}
                onChange={() => setCertificadoEstado('NO_CUMPLE')} />
              No cumple
            </label>
          </div>
        </fieldset>

        <label style={campo}>
          <span style={etiqueta}>Fecha del certificado</span>
          <input className="input" type="date" max={hoyChile()} value={certificadoFecha}
            onChange={(event) => setCertificadoFecha(event.target.value)} />
          {deOtroSemestre && <small style={{ color: '#b91c1c' }}>Es de otro semestre: el SII lo actualiza en enero y julio.</small>}
          {antiguo && <small style={{ color: '#b45309' }}>Tiene más de {DIAS_CERTIFICADO_RECIENTE} días: sirve, pero conviene uno reciente.</small>}
        </label>

        <label style={campo}>
          <span style={etiqueta}>Inicio de actividades en sii.cl</span>
          <select className="select" value={inicioActividades}
            onChange={(event) => setInicioActividades(event.target.value as EstadoInicio | '')}>
            <option value="">Selecciona lo que muestra el SII</option>
            <option value="VIGENTE">Vigente</option>
            <option value="TERMINO_GIRO">Término de giro</option>
            <option value="SIN_INICIO">Sin inicio de actividades</option>
          </select>
        </label>

        <div style={campo}>
          <span style={etiqueta}>Consulta el RUT (el certificado no dice si el inicio sigue vigente)</span>
          <div style={{ ...enLinea, gap: 8 }}>
            <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{rut}</strong>
            <button type="button" style={enlace} onClick={() => void copiarRut()} title="Copiar RUT">
              <UiIcon name={rutCopiado ? 'check' : 'clipboard'} /> {rutCopiado ? 'Copiado' : 'Copiar'}
            </button>
            <a href={SII_CONSULTA_TERCEROS} target="_blank" rel="noopener noreferrer" style={enlace}>
              Abrir sii.cl <UiIcon name="arrowRight" />
            </a>
          </div>
        </div>
      </div>

      {conObservacion && (
        <label style={campo}>
          <span style={etiqueta}>Observación (opcional)</span>
          <input className="input" type="text" maxLength={500} value={observaciones} autoFocus
            onChange={(event) => setObservaciones(event.target.value)} />
        </label>
      )}

      <div className="verificacion-alta-sii-pie">
        <span style={{ flex: 1, minWidth: 220, fontSize: 13, color: resumen.color, display: 'flex', gap: 6, alignItems: 'center' }}>
          <UiIcon name={resumen.icono} /> {resumen.texto}
        </span>
        {!conObservacion && (
          <button type="button" onClick={() => setConObservacion(true)}
            style={{ border: 0, background: 'transparent', color: '#0b63f3', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            + Observación
          </button>
        )}
        <button className="validation-action-button approve" type="submit" disabled={mutation.isPending}>
          <UiIcon name="fileCheck" />
          {mutation.isPending ? 'Registrando…' : 'Registrar verificación'}
        </button>
      </div>

      {error && <p className="validation-decision-hint" style={{ color: '#b91c1c', margin: 0 }}><UiIcon name="alert" /> {error}</p>}
    </form>
  );
}
