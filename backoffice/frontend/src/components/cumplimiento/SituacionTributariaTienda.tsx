import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as administrationApi from '@/api/administration';
import * as validationsApi from '@/api/validations';
import UiIcon from '@/components/shared/UiIcon';
import {
  HistorialVerificacionesSii,
  RESULTADO_LABEL,
  RegistrarVerificacionSiiModal,
  abrirUrlFirmada,
  type TiendaAVerificar,
} from './situacionTributariaComun';
import type { ResultadoVerificacionSii } from '@/api/administration';

/**
 * Situacion tributaria de una tienda, en su perfil (Confianza → Vendedores). 9-oct: quien revisa una
 * tienda ve aqui su declaracion de IVA, su certificado y su verificacion del semestre, y puede
 * registrar una verificacion nueva sin ir a la bandeja.
 */
export default function SituacionTributariaTienda({ proveedorId, nombreTienda, rut }: {
  proveedorId: number;
  nombreTienda: string;
  rut: string;
}) {
  const [aVerificar, setAVerificar] = useState<TiendaAVerificar | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const estadoQuery = useQuery({
    queryKey: ['validation-tax-status', proveedorId],
    queryFn: () => validationsApi.getSellerTaxStatus(proveedorId),
  });

  if (estadoQuery.isLoading) return <p className="row-sub">Cargando situación tributaria…</p>;
  if (estadoQuery.isError || !estadoQuery.data) return <p className="row-sub">No se pudo cargar la situación tributaria.</p>;

  const estado = estadoQuery.data;
  const ultima = estado.ultimaVerificacion;
  const resultado = (ultima?.resultado ?? '') as ResultadoVerificacionSii | '';
  const esteSemestre = ultima?.semestre === estado.semestreActual;
  const chips = [
    { ok: Boolean(estado.declaracionIvaAt), texto: 'Declaración IVA' },
    { ok: estado.tieneCertificado, texto: 'Certificado' },
    {
      ok: esteSemestre && (resultado === 'CUMPLE' || resultado === 'NO_CUMPLE'),
      texto: esteSemestre && resultado ? `${estado.semestreActual}: ${RESULTADO_LABEL[resultado].text}` : `${estado.semestreActual}: sin verificar`,
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {chips.map((chip) => (
          <span key={chip.texto} className={`status-pill ${chip.ok ? 'tone-green' : 'tone-amber'}`}>{chip.texto}</span>
        ))}
      </div>
      <p className="row-sub" style={{ margin: 0 }}>
        {ultima
          ? `Última verificación: ${new Date(`${ultima.verificadaEn}T12:00:00`).toLocaleDateString('es-CL')} (${ultima.semestre}).`
          : 'Todavía no tiene verificaciones registradas.'}
        {estado.declaracionIvaAt && ` Declaró ser contribuyente de IVA el ${new Date(estado.declaracionIvaAt).toLocaleDateString('es-CL')}.`}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {estado.tieneCertificado && (
          <button className="secondary-button" type="button"
            onClick={() => void abrirUrlFirmada(() => administrationApi.getTaxStatusCertificateUrl(proveedorId), 'No se pudo abrir el certificado.')}>
            <UiIcon name="eye" /> Ver certificado
          </button>
        )}
        <button className="secondary-button" type="button"
          onClick={() => setAVerificar({ proveedorId, nombreTienda, rut })}>
          <UiIcon name="fileCheck" /> Verificar en el SII
        </button>
        <button className="profile-inline-link" type="button" onClick={() => setVerHistorial((actual) => !actual)}>
          {verHistorial ? 'Ocultar historial' : 'Ver historial'} <UiIcon name="arrowRight" />
        </button>
      </div>
      {verHistorial && <HistorialVerificacionesSii proveedorId={proveedorId} />}
      <RegistrarVerificacionSiiModal tienda={aVerificar} onClose={() => setAVerificar(null)} />
    </div>
  );
}
