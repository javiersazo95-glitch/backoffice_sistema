import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as validationsApi from '@/api/validations';
import type { RegisterSellerTaxStatusPayload } from '@/api/validations';
import { mensajeDeError } from '@/api/client';
import UiIcon from '@/components/shared/UiIcon';

/**
 * Verificacion tributaria del alta, en la misma pagina en que se aprueba la tienda.
 *
 * Al contratar, la Res. SII 168 de 2025 (resolutivo 2°) exige el certificado de cumplimiento: el
 * revisor abre el PDF que subio la tienda (en Documentos requeridos) y registra el estado y la
 * fecha que muestra. El certificado no dice si el inicio de actividades sigue vigente (Res. 99),
 * asi que eso se marca tras consultar el RUT en sii.cl. Queda como via "Certificado", con el PDF de
 * la tienda como evidencia.
 */

// Guia oficial del SII para consultar la situacion tributaria de terceros (verificada el 2026-10-09).
const SII_CONSULTA_TERCEROS = 'https://www.sii.cl/como_se_hace_para/situacion_trib_terceros.html';
const DIAS_CERTIFICADO_RECIENTE = 30;

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

interface Props {
  sellerId: number;
  rut: string;
  semestreActual: string;
  onRegistered?: () => void;
}

export default function VerificacionAltaSii({ sellerId, rut, semestreActual, onRegistered }: Props) {
  const queryClient = useQueryClient();
  const [certificadoEstado, setCertificadoEstado] = useState<RegisterSellerTaxStatusPayload['certificadoEstado'] | ''>('');
  const [certificadoFecha, setCertificadoFecha] = useState('');
  const [inicioActividades, setInicioActividades] = useState<RegisterSellerTaxStatusPayload['inicioActividades'] | ''>('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [rutCopiado, setRutCopiado] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: RegisterSellerTaxStatusPayload) => validationsApi.registerSellerTaxStatus(sellerId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['validation-tax-status', sellerId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-tax-status'] });
      onRegistered?.();
    },
    onError: (err) => setError(mensajeDeError(err, 'No se pudo registrar la verificación.')),
  });

  const deOtroSemestre = Boolean(certificadoFecha) && semestreDe(certificadoFecha) !== semestreActual;
  const antiguo = Boolean(certificadoFecha) && !deOtroSemestre && diasDesde(certificadoFecha) > DIAS_CERTIFICADO_RECIENTE;

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
      certificadoEstado: certificadoEstado as RegisterSellerTaxStatusPayload['certificadoEstado'],
      certificadoFecha,
      inicioActividades: inicioActividades as RegisterSellerTaxStatusPayload['inicioActividades'],
      inicioActividadesFecha: null,
      observaciones: observaciones.trim() || null,
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

  const opcion = (activa: boolean) => ({
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${activa ? '#2563eb' : '#cbd5e1'}`,
    background: activa ? '#eff6ff' : '#fff',
    color: activa ? '#1d4ed8' : '#334155',
    fontWeight: activa ? 600 : 500,
    cursor: 'pointer',
  });

  return (
    <form onSubmit={submit} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'grid', gap: 14 }}>
      <strong>Registrar verificación del alta</strong>

      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#475569' }}>
          1. Abre el certificado en <em>Documentos requeridos</em>, revisa que el RUT y el nombre coincidan con la tienda, e indica qué dice:
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" style={opcion(certificadoEstado === 'CUMPLE')} onClick={() => setCertificadoEstado('CUMPLE')}>Cumple</button>
          <button type="button" style={opcion(certificadoEstado === 'NO_CUMPLE')} onClick={() => setCertificadoEstado('NO_CUMPLE')}>No cumple</button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#475569' }}>
            Fecha del certificado
            <input className="input" type="date" max={hoyChile()} value={certificadoFecha} style={{ width: 'auto' }}
              onChange={(event) => setCertificadoFecha(event.target.value)} />
          </label>
        </div>
        {deOtroSemestre && (
          <small style={{ color: '#b91c1c' }}>
            Ese certificado es de otro semestre: el estado se actualiza en enero y julio. Pide uno nuevo con una corrección.
          </small>
        )}
        {antiguo && (
          <small style={{ color: '#b45309' }}>
            Tiene más de {DIAS_CERTIFICADO_RECIENTE} días. Sirve para este semestre, pero conviene uno reciente.
          </small>
        )}
        {certificadoEstado === 'NO_CUMPLE' && (
          <small style={{ color: '#475569' }}>
            Puede vender igual. RepuesTop deberá anticipar parte del IVA cuando el SII lo reglamente (Res. 168, resolutivo 7°).
          </small>
        )}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#475569' }}>
          2. El certificado no dice si el inicio de actividades sigue vigente. Consulta el RUT{' '}
          <strong>{rut}</strong>{' '}
          <button type="button" className="ghost-button" onClick={() => void copiarRut()} style={{ padding: '2px 8px' }}>
            {rutCopiado ? 'Copiado' : 'Copiar'}
          </button>{' '}
          en <a href={SII_CONSULTA_TERCEROS} target="_blank" rel="noopener noreferrer">sii.cl (situación tributaria de terceros)</a>:
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={opcion(inicioActividades === 'VIGENTE')} onClick={() => setInicioActividades('VIGENTE')}>Inicio de actividades vigente</button>
          <button type="button" style={opcion(inicioActividades === 'TERMINO_GIRO')} onClick={() => setInicioActividades('TERMINO_GIRO')}>Término de giro</button>
          <button type="button" style={opcion(inicioActividades === 'SIN_INICIO')} onClick={() => setInicioActividades('SIN_INICIO')}>Sin inicio de actividades</button>
        </div>
        {(inicioActividades === 'TERMINO_GIRO' || inicioActividades === 'SIN_INICIO') && (
          <small style={{ color: '#b91c1c' }}>
            Sin inicio de actividades vigente la tienda no se puede aprobar (art. 68 del Código Tributario).
          </small>
        )}
      </div>

      <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#475569' }}>
        Observaciones (opcional)
        <input className="input" type="text" maxLength={500} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} />
      </label>

      {error && <p className="validation-decision-hint" style={{ color: '#b91c1c' }}><UiIcon name="alert" /> {error}</p>}

      <div>
        <button className="validation-action-button approve" type="submit" disabled={mutation.isPending}>
          <UiIcon name="fileCheck" />
          {mutation.isPending ? 'Registrando…' : 'Registrar verificación'}
        </button>
      </div>
    </form>
  );
}
