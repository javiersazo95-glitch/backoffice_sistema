import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getContactHistory, registerContact, unmarkNotified } from '@/api/tracking';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import { formatDate, formatDateTime } from '@/utils/formatters';
import type { ContactResult, TrackedProfile, TrackedPublication, TrackingKind } from '@/types/tracking';

export const CONTACT_RESULTS: Array<{ value: ContactResult; label: string; tone: string }> = [
  { value: 'NOTIFICADO', label: 'Notificado de la publicación', tone: 'green' },
  { value: 'CONTACTADO', label: 'Contactado', tone: 'blue' },
  { value: 'COMPROMETIO', label: 'Comprometió ingreso', tone: 'green' },
  { value: 'NO_CONTESTA', label: 'No contesta', tone: 'amber' },
  { value: 'NO_INTERESADO', label: 'No le interesa', tone: 'red' },
];

export function contactResultMeta(value: string) {
  return CONTACT_RESULTS.find((item) => item.value === value) ?? { value, label: value, tone: '' };
}

/** Número para wa.me: sólo dígitos y con el prefijo de Chile si viene como número local de 9 dígitos. */
function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, '');
  const international = digits.length === 9 ? `56${digits}` : digits;
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copiado`);
  } catch {
    showToast('No se pudo copiar');
  }
}

interface ContactModalProps {
  kind: TrackingKind;
  publication: TrackedPublication;
  profile: TrackedProfile;
  onClose: () => void;
}

function DataRow({ icon, label, value, children }: { icon: string; label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #eef2f7' }}>
      <span style={{ width: 20, color: '#64748b', display: 'inline-flex' }}><UiIcon name={icon} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-sub">{label}</div>
        <strong style={{ overflowWrap: 'anywhere' }}>{value || 'No registrado'}</strong>
      </div>
      {value ? <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>{children}</div> : null}
    </div>
  );
}

/** Datos para contactar al perfil, mensaje sugerido y la marca de "ya notificado" de esta publicación. */
export default function ContactModal({ kind, publication, profile, onClose }: ContactModalProps) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ContactResult>('NOTIFICADO');
  const [note, setNote] = useState('');
  const [nextContact, setNextContact] = useState('');

  const what = kind === 'fallas' ? 'falla automotriz' : 'necesidad de compra';
  const action = kind === 'fallas' ? 'dejar tu diagnóstico' : 'registrar tu oferta';
  const detail = [publication.titulo, publication.vehiculo, publication.comuna].filter(Boolean).join(' · ');
  const message = `Hola ${profile.responsable || profile.nombre}, te escribimos de RepuesTop. Hay una nueva ${what} que puede interesarte: ${detail}. Ingresa a la plataforma para ${action}.`;

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['tracking-contacts', profile.id],
    queryFn: () => getContactHistory(profile.id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tracking-contacts', profile.id] });
    queryClient.invalidateQueries({ queryKey: ['tracking-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['tracking-publications'] });
  };

  const save = useMutation({
    mutationFn: () => registerContact({
      perfilId: profile.id,
      publicacionTipo: kind === 'fallas' ? 'FALLA' : 'NECESIDAD',
      publicacionId: publication.id,
      resultado: result,
      nota: note.trim() || undefined,
      proximoContacto: nextContact || undefined,
    }),
    onSuccess: () => {
      showToast(result === 'NOTIFICADO' ? 'Perfil marcado como notificado' : 'Contacto registrado');
      setNote('');
      setNextContact('');
      refresh();
    },
    onError: (error: any) => showToast(error?.response?.data?.message || 'No se pudo registrar el contacto'),
  });

  const unmark = useMutation({
    mutationFn: () => unmarkNotified(kind, publication.id, profile.id),
    onSuccess: () => { showToast('Se quitó la marca de notificado'); refresh(); },
    onError: () => showToast('No se pudo quitar la marca'),
  });

  return (
    <div className="case-modal-backdrop" onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ zIndex: 1200 }}>
      <div className="seller-documents-modal" style={{ maxWidth: '680px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
        <header className="seller-documents-header">
          <div className="seller-documents-heading">
            <span className="seller-documents-icon"><UiIcon name="smartphone" /></span>
            <div className="seller-documents-title">
              <h2>Contactar a {profile.nombre}</h2>
              <p>{detail}</p>
            </div>
          </div>
          <button className="seller-documents-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
            <span>Cerrar</span>
          </button>
        </header>

        <section style={{ padding: '20px', maxHeight: 'min(600px, calc(100dvh - 150px))', overflowY: 'auto', display: 'grid', gap: 18 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>Datos de contacto</h3>
            <DataRow icon="users" label="Responsable" value={profile.responsable} />
            <DataRow icon="smartphone" label="Teléfono" value={profile.telefono}>
              <a className="secondary-button" style={{ padding: '4px 10px', fontSize: 12 }} href={`tel:${(profile.telefono ?? '').replace(/\s+/g, '')}`}>Llamar</a>
              <button className="secondary-button" type="button" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => void copy(profile.telefono ?? '', 'Teléfono')}>Copiar</button>
            </DataRow>
            <DataRow icon="message" label="WhatsApp" value={profile.whatsapp || profile.telefono}>
              <a className="secondary-button" style={{ padding: '4px 10px', fontSize: 12 }} target="_blank" rel="noreferrer"
                href={whatsappLink(profile.whatsapp || profile.telefono || '', message)}>Abrir con mensaje</a>
            </DataRow>
            <DataRow icon="mail" label="Correo" value={profile.email}>
              <a className="secondary-button" style={{ padding: '4px 10px', fontSize: 12 }} href={`mailto:${profile.email ?? ''}`}>Escribir</a>
              <button className="secondary-button" type="button" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => void copy(profile.email ?? '', 'Correo')}>Copiar</button>
            </DataRow>
            <DataRow icon="home" label="Dirección" value={[profile.direccion, profile.comuna].filter(Boolean).join(', ')} />
            {profile.horario && <DataRow icon="clock" label="Horario" value={profile.horario} />}
            {profile.registradoEn && <DataRow icon="calendar" label="Registrado" value={formatDate(profile.registradoEn)} />}
          </div>

          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>Por qué le sirve</h3>
            {profile.motivos.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {profile.motivos.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            ) : <p className="row-sub">Está dentro del alcance, pero no cumple categoría ni marca de la publicación.</p>}
          </div>

          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>Mensaje sugerido</h3>
            <p style={{ margin: '0 0 8px', padding: 10, background: '#f8fafc', borderRadius: 8 }}>{message}</p>
            <button className="secondary-button" type="button" onClick={() => void copy(message, 'Mensaje')}>Copiar mensaje</button>
          </div>

          <div style={{ display: 'grid', gap: 12, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>
              Seguimiento {profile.notificado && <Badge text={`✓ Notificado ${profile.notificadoEn ? formatDate(profile.notificadoEn) : ''}`.trim()} variant="green" />}
            </h3>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="row-sub">Resultado</span>
              <select className="select" value={result} onChange={(e) => setResult(e.target.value as ContactResult)}>
                {CONTACT_RESULTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="row-sub">Nota (opcional)</span>
              <textarea className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Quién contestó, qué dijo, qué pidió…" />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="row-sub">Próxima llamada (opcional)</span>
              <input className="input" type="date" value={nextContact} onChange={(e) => setNextContact(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="primary-button" type="button" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? 'Guardando...' : result === 'NOTIFICADO' ? 'Marcar como notificado' : 'Guardar contacto'}
              </button>
              {profile.notificado && (
                <button className="secondary-button" type="button" disabled={unmark.isPending} onClick={() => unmark.mutate()}>Quitar marca de notificado</button>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Historial con este perfil</h3>
            {isLoading ? (
              <p className="row-sub">Cargando historial...</p>
            ) : history.length ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {history.map((contact) => {
                  const meta = contactResultMeta(contact.resultado);
                  return (
                    <div key={contact.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Badge text={meta.label} variant={meta.tone} />
                        <span className="row-sub">{formatDateTime(contact.createdAt)}{contact.responsable ? ` · ${contact.responsable}` : ''}</span>
                      </div>
                      {contact.publicacionTipo && (
                        <p className="row-sub" style={{ margin: '6px 0 0' }}>
                          {contact.publicacionTipo === 'FALLA' ? 'Falla' : 'Necesidad'} #{contact.publicacionId}
                        </p>
                      )}
                      {contact.nota && <p style={{ margin: '6px 0 0' }}>{contact.nota}</p>}
                      {contact.proximoContacto && <p className="row-sub" style={{ margin: '6px 0 0' }}>Próxima llamada: {formatDate(contact.proximoContacto)}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="row-sub">Aún no hay contactos registrados con este perfil.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
