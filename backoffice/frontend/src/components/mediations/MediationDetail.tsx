import { useEffect, useState, useMemo, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MediationResponse, MediationStatus, type MediationDetailResponse, type MediationEvidenceResponse, type MediationMessageResponse } from '@/types/mediation';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import { formatCurrency, formatDateTime, mediationStatusDisplay } from '@/utils/formatters';
import { getReports } from '@/api/reports';
import { resolveProfileImageUrl } from '@/api/client';
import mediatorProfileImage from '@/assets/mediator-profile.jpg';

type MediationModalItem = MediationResponse & Partial<MediationDetailResponse>;

interface MediationDetailProps {
  isOpen: boolean;
  item: MediationModalItem | null;
  onClose: () => void;
  onResolve: (id: number, reason: string, file: File) => void;
  onBlockAccount: (id: number) => void;
  onSendMessage: (mediationId: number, text: string, targetRole: string) => void;
}

type ChatSide = 'buyer' | 'seller';

interface ChatMessage {
  id: string;
  text: string;
  author: string;
  time: string;
  side: ChatSide;
  aligned: 'left' | 'right';
  label: string;
  isMediator: boolean;
}

function formatChatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function resolveBuyerName(item: MediationModalItem) {
  return item.buyer || item.title.replace('Comprador vs ', '') || 'Comprador';
}

function mapBackendMessages(messages: MediationMessageResponse[] | undefined, side: ChatSide): ChatMessage[] {
  return (messages ?? []).map((message) => ({
    id: String(message.id),
    text: message.text,
    author: message.author,
    time: formatChatTime(message.createdAt),
    side,
    aligned: message.senderRole === 'MEDIADOR' ? 'right' : 'left',
    label: message.senderRole === 'MEDIADOR' ? 'Mediador' : message.senderRole === 'SISTEMA' ? 'Sistema' : side === 'buyer' ? 'Comprador' : 'Tienda',
    isMediator: message.senderRole === 'MEDIADOR',
  }));
}

function resolveInitializationReason(item: MediationModalItem) {
  if (item.escalationReason?.trim()) return item.escalationReason.trim();

  const allMessages = [...(item.messages ?? []), ...(item.buyerMessages ?? []), ...(item.sellerMessages ?? [])];
  const sorted = [...new Map(allMessages.map((m) => [m.id, m])).values()].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  const taggedMessage = sorted.find((message) =>
    ['inicio_mediacion', 'solicitud_mediador'].includes(String(message.noteType ?? message.type ?? '')),
  );
  if (taggedMessage?.text?.trim()) return taggedMessage.text.trim();

  const earliestMessage = sorted[0];
  if (item.mediationStarted && earliestMessage?.text?.trim()) return earliestMessage.text.trim();

  return '';
}

interface UnifiedNote {
  id: string;
  type: 'note' | 'report';
  date: string;
  title: string;
  text: string;
  author: string;
  noteType?: string;
  reporterType?: string;
  source?: string;
  externalId?: string;
  reportedParty: 'COMPRADOR' | 'VENDEDOR';
}

function buildUnifiedHistory(
  item: MediationModalItem,
  reports: any[],
  buyerName: string,
): UnifiedNote[] {
  const sellerName = item.sellerName || 'Tienda';
  const formatSellerName = (name: string) => {
    const trimmed = name.trim();
    if (trimmed.toLowerCase().startsWith('tienda')) return trimmed;
    return `tienda ${trimmed}`;
  };

  const filteredReports = reports.filter((report) => {
    // 1. Report received by the seller (reported is the seller)
    const reportedIsSeller = report.reportadoType === 'VENDEDOR' && (
      String(report.reportadoId) === String(item.sellerId) || 
      report.reportadoName?.trim().toLowerCase() === sellerName.trim().toLowerCase() ||
      sellerName.trim().toLowerCase().includes(report.reportadoName?.trim().toLowerCase() ?? '') ||
      report.reportadoName?.trim().toLowerCase().includes(sellerName.trim().toLowerCase() ?? '')
    );

    // 2. Report received by the buyer (reported is the buyer)
    const reportedIsBuyer = report.reportadoType === 'COMPRADOR' && (
      report.reportadoName?.trim().toLowerCase() === buyerName.trim().toLowerCase() ||
      buyerName.trim().toLowerCase().includes(report.reportadoName?.trim().toLowerCase() ?? '') ||
      report.reportadoName?.trim().toLowerCase().includes(buyerName.trim().toLowerCase())
    );

    return reportedIsSeller || reportedIsBuyer;
  });

  const reportEntries: UnifiedNote[] = filteredReports.map((report) => {
    const reportedParty = report.reportadoType;
    const reporterName = report.reportanteName || (report.reportanteType === 'COMPRADOR' ? buyerName : sellerName);
    const title = reportedParty === 'VENDEDOR'
      ? `${reporterName} hizo un reporte a ${formatSellerName(sellerName)}`
      : `${formatSellerName(reporterName)} hizo un reporte a ${buyerName}`;

    const isTicket = report.idExterno?.startsWith('TCK-');

    return {
      id: `report-${report.id}`,
      type: 'report',
      date: report.fechaCreacion,
      title,
      text: `Motivo: ${report.motivo}\nDetalle: ${report.descripcion}`,
      author: reporterName,
      reporterType: report.reportanteType,
      source: isTicket ? 'Canal de Ayuda' : 'Reporte de Usuario',
      externalId: report.idExterno,
      reportedParty,
    };
  });

  return reportEntries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

function ChatBubble({ message, accent, partyPhotoUrl }: { message: ChatMessage; accent: 'blue' | 'violet'; partyPhotoUrl?: string | null }) {
  const showPartyAvatar = !message.isMediator && message.aligned === 'left' && !!partyPhotoUrl;

  return (
    <div className={`chat-bubble-row ${message.aligned === 'left' ? 'incoming' : 'outgoing'} ${message.isMediator ? 'mediator' : ''}`}>
      {message.isMediator ? (
        <span className="chat-mediator-avatar">
          <img src={mediatorProfileImage} alt="Mediador RepuesTop" />
        </span>
      ) : null}
      {showPartyAvatar ? (
        <span className="chat-party-avatar">
          <img src={partyPhotoUrl} alt={message.label} />
        </span>
      ) : null}
      <div className={`chat-bubble ${message.aligned === 'left' ? 'incoming' : 'outgoing'} ${accent}`}>
        <div className="chat-bubble-meta">
          <strong>{message.label}</strong>
        </div>
        <p>{message.text}</p>
        <span>{message.time}</span>
      </div>
    </div>
  );
}

function EvidenceSection({
  title,
  partyName,
  evidence,
  accent,
}: {
  title: string;
  partyName: string;
  evidence: MediationEvidenceResponse[];
  accent: 'blue' | 'violet';
}) {
  return (
    <section className={`mediation-evidence-card ${accent}`}>
      <div className="mediation-evidence-head">
        <span className="mediation-evidence-icon"><UiIcon name="document" /></span>
        <div>
          <h3>{title}</h3>
          <span>{partyName} · {evidence.length} {evidence.length === 1 ? 'archivo' : 'archivos'}</span>
        </div>
      </div>

          {evidence.length ? (
        <div className="mediation-evidence-list">
          {evidence.map((file) => {
            const name = file.fileName || `Evidencia ${file.id}`;
            return (
              <div className="mediation-evidence-file" key={file.id}>
                <span className="mediation-evidence-file-icon"><UiIcon name="document" /></span>
                <div className="mediation-evidence-file-copy">
                  <strong>{name}</strong>
                  <small>{file.uploadedAt ? new Date(file.uploadedAt).toLocaleString('es-CL') : file.mimeType || 'Documento de evidencia'}</small>
                </div>
                <div className="mediation-evidence-actions">
                  <a href={file.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${name}`} title="Abrir evidencia">
                    <UiIcon name="eye" />
                  </a>
                  <a href={file.url} download={name} aria-label={`Descargar ${name}`} title="Descargar evidencia">
                    <UiIcon name="download" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mediation-evidence-empty">
          <UiIcon name="document" />
          <span>Esta parte aún no ha subido evidencias.</span>
        </div>
      )}
    </section>
  );
}

function ChatCard({
  title,
  partyName,
  icon,
  photoUrl,
  messages,
  accent,
  placeholder,
  onSend,
  disabled,
}: {
  title: string;
  partyName: string;
  icon: string;
  photoUrl?: string | null;
  messages: ChatMessage[];
  accent: 'blue' | 'violet';
  placeholder: string;
  onSend: (value: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const resolvedPhotoUrl = useMemo(() => resolveProfileImageUrl(photoUrl), [photoUrl]);
  const [imageFailed, setImageFailed] = useState(false);
  const visiblePhotoUrl = resolvedPhotoUrl && !imageFailed ? resolvedPhotoUrl : null;

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedPhotoUrl]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setDraft('');
  };

  return (
    <section className="mediation-chat-card">
      <div className="mediation-chat-header">
        <div className="mediation-chat-title">
          <span className="mediation-chat-icon">
            {visiblePhotoUrl ? (
              <img
                src={visiblePhotoUrl}
                alt={partyName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <UiIcon name={icon} />
            )}
          </span>
          <div>
            <h3>{title}</h3>
            <span className="mediation-chat-party">{partyName}</span>
          </div>
        </div>
        <span className="mediation-chat-badge">{disabled ? 'Cerrado' : 'En línea'}</span>
      </div>

      <div className="mediation-chat-thread">
        {messages.length ? (
          messages.map((message) => <ChatBubble key={message.id} message={message} accent={accent} partyPhotoUrl={visiblePhotoUrl} />)
        ) : (
          <div className="mediation-chat-empty">
            <UiIcon name="message" />
            <p>{placeholder}</p>
          </div>
        )}
      </div>

      <div className="mediation-chat-composer">
        <input
          className="mediation-chat-input"
          type="text"
          value={draft}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
          placeholder={disabled ? 'Chat cerrado' : 'Escribe un mensaje...'}
          aria-label={`Mensaje para ${title.toLowerCase()}`}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSend();
            }
          }}
        />
        <button className={`mediation-chat-send ${accent}`} type="button" aria-label="Enviar mensaje" onClick={handleSend} disabled={disabled}>
          <UiIcon name="arrowRight" />
        </button>
      </div>
    </section>
  );
}

export default function MediationDetail({
  isOpen,
  item,
  onClose,
  onResolve,
  onBlockAccount,
  onSendMessage,
}: MediationDetailProps) {
  const [resolutionReason, setResolutionReason] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [decision, setDecision] = useState<'resolve' | 'block'>('resolve');
  const [historyFilter, setHistoryFilter] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;
    setResolutionReason('');
    setDocumentFile(null);
    setDecision('resolve');
    setHistoryFilter('all');
  }, [isOpen, item?.id]);

  const { data: allReportsData } = useQuery({
    queryKey: ['all-reports-for-mediation-detail'],
    queryFn: () => getReports({ size: 1000 }),
    enabled: !!item && isOpen,
  });

  const buyerName = item ? resolveBuyerName(item) : 'Comprador';
  const sellerName = item?.sellerName || 'Tienda';
  const buyerPhotoUrl = item ? resolveProfileImageUrl(
    item.buyerPhotoUrl,
    item.buyerProfileImageUrl,
    item.buyerProfileUrl,
    item.buyerUserProfileUrl,
    item.buyerAvatarUrl,
    item.profileImageUrl,
    item.userProfileUrl,
    item.avatarUrl,
  ) : null;
  const sellerPhotoUrl = item ? resolveProfileImageUrl(
    item.sellerPhotoUrl,
    item.sellerProfileImageUrl,
    item.sellerProfileUrl,
    item.sellerUserProfileUrl,
    item.sellerAvatarUrl,
    item.profileImageUrl,
    item.userProfileUrl,
    item.avatarUrl,
  ) : null;
  const canBlockSeller = item?.canBlockAccount !== false && !item?.accountBlocked;
  const blockingCode = item?.blockingMediationExternalId || (item?.blockingMediationId ? `MED-${item.blockingMediationId}` : '');

  const unifiedHistory = useMemo(
    () => item ? buildUnifiedHistory(item, allReportsData?.content ?? [], buyerName) : [],
    [item, allReportsData, buyerName],
  );

  const filteredHistory = useMemo(() => {
    return unifiedHistory.filter((entry) => {
      if (historyFilter === 'seller') return entry.reportedParty === 'VENDEDOR';
      if (historyFilter === 'buyer') return entry.reportedParty === 'COMPRADOR';
      return true;
    });
  }, [unifiedHistory, historyFilter]);

  if (!isOpen || !item) return null;

  const initializationReason = resolveInitializationReason(item);

  const handleResolve = () => {
    if (!resolutionReason.trim() || !documentFile) return;
    onResolve(item.id, resolutionReason.trim(), documentFile);
  };

  const handleDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDocumentFile(event.target.files?.[0] ?? null);
  };

  return (
    <div className="case-modal-backdrop mediation-management-backdrop" onClick={onClose}>
      <div className="mediation-management-modal" onClick={(event) => event.stopPropagation()}>
        <div className="mediation-management-shell">
          <div className="mediation-management-header">
            <div className="mediation-management-heading">
              <span className="mediation-management-icon">
                <UiIcon name="scale" />
              </span>
              <div className="mediation-management-title">
                <h2>Gestionar mediación</h2>
                <div className="mediation-management-meta">
                  <span>{item.externalId}</span>
                  <Badge text={mediationStatusDisplay(item.status, item.accountBlocked)} variant={item.accountBlocked ? 'cuenta-bloqueada' : item.status} />
                </div>
              </div>
            </div>

            <button className="mediation-management-close" type="button" onClick={onClose}>
              <UiIcon name="close" />
              <span>Cerrar</span>
            </button>
          </div>

          <section className="mediation-summary-strip">
            <div className="mediation-summary-item">
              <span className="mediation-summary-icon">
                <UiIcon name="cart" />
              </span>
              <div>
                <small>Pedido</small>
                <strong>{item.orderId}</strong>
              </div>
            </div>
            <div className="mediation-summary-item">
              <span className="mediation-summary-icon">
                <UiIcon name="users" />
              </span>
              <div>
                <small>Comprador</small>
                <strong>{buyerName}</strong>
              </div>
            </div>
            <div className="mediation-summary-item">
              <span className="mediation-summary-icon violet">
                <UiIcon name="users" />
              </span>
              <div>
                <small>Tienda</small>
                <strong><FounderSellerName name={sellerName} founder={item.sellerFounder} /></strong>
              </div>
            </div>
            <div className="mediation-summary-item">
              <span className="mediation-summary-icon">
                <UiIcon name="document" />
              </span>
              <div>
                <small>Motivo</small>
                <strong>{item.reason}</strong>
              </div>
            </div>
            <div className="mediation-summary-item">
              <span className="mediation-summary-icon">
                <UiIcon name="wallet" />
              </span>
              <div>
                <small>Monto</small>
                <strong>{formatCurrency(item.amount)}</strong>
              </div>
            </div>
          </section>

          <section className="mediation-management-grid">
            <section className="mediation-init-reason-card">
              <div className="mediation-init-reason-head">
                <span className="mediation-init-reason-icon">
                  <UiIcon name="message" />
                </span>
                <div>
                  <span className="mediation-init-reason-kicker">Motivo de inicialización</span>
                </div>
              </div>
              <p>{initializationReason || 'Sin motivo de inicialización registrado.'}</p>
            </section>

            <section className="mediation-evidence-area">
              <div className="mediation-evidence-area-head">
                <div>
                  <span className="mediation-init-reason-kicker">Documentos del caso</span>
                  <h3>Evidencias de comprador y tienda</h3>
                </div>
                <p>Archivos adjuntados por cada parte durante la conversación.</p>
              </div>
              <div className="mediation-evidence-grid">
                <EvidenceSection title="Evidencias del comprador" partyName={buyerName} evidence={item.buyerEvidence ?? []} accent="blue" />
                <EvidenceSection title="Evidencias de la tienda" partyName={sellerName} evidence={item.sellerEvidence ?? []} accent="violet" />
              </div>
            </section>

            <ChatCard
              title="Chat con comprador"
              partyName={buyerName}
              icon="users"
              photoUrl={buyerPhotoUrl}
              messages={mapBackendMessages(item.buyerMessages, 'buyer')}
              accent="blue"
              placeholder="Aún no hay mensajes en este chat."
              onSend={(value) => item?.id && onSendMessage(item.id, value, 'COMPRADOR')}
              disabled={item.status === MediationStatus.RESUELTA || item.accountBlocked || item.buyerMessages?.some((m) => m.closed)}
            />

            <ChatCard
              title="Chat con tienda"
              partyName={sellerName}
              icon="users"
              photoUrl={sellerPhotoUrl}
              messages={mapBackendMessages(item.sellerMessages, 'seller')}
              accent="violet"
              placeholder="Aún no hay mensajes en este chat."
              onSend={(value) => item?.id && onSendMessage(item.id, value, 'VENDEDOR')}
              disabled={item.status === MediationStatus.RESUELTA || item.accountBlocked || item.sellerMessages?.some((m) => m.closed)}
            />

            <section className="mediation-actions-card">
              <div className="mediation-actions-card-head">
                <UiIcon name="scale" />
                <h3>Acciones del mediador</h3>
              </div>

              <div className="mediation-choice-list">
                <button
                  className={`mediation-choice ${decision === 'resolve' ? 'selected' : ''}`}
                  type="button"
                  onClick={() => setDecision('resolve')}
                >
                  <span className="mediation-choice-radio" />
                  <div>
                    <strong>Resolver mediación</strong>
                    <p>Cierra el caso y notifica a ambas partes.</p>
                  </div>
                  <span className="mediation-choice-action">
                    <UiIcon name="check" />
                  </span>
                </button>

                <button
                  className={`mediation-choice danger ${decision === 'block' ? 'selected' : ''}`}
                  type="button"
                  onClick={() => {
                    if (canBlockSeller) setDecision('block');
                  }}
                  disabled={!canBlockSeller}
                >
                  <span className="mediation-choice-radio" />
                  <div>
                    <strong>Bloquear cuenta de la tienda</strong>
                    <p>
                      {canBlockSeller
                        ? 'Suspende la cuenta de la tienda.'
                        : `No disponible: la cuenta ya fue bloqueada por ${blockingCode}.`}
                    </p>
                  </div>
                  <span className="mediation-choice-action danger">
                    <UiIcon name="shieldX" />
                  </span>
                </button>
              </div>

              {!canBlockSeller && blockingCode ? (
                <div className="mediation-blocking-warning">
                  <UiIcon name="lock" />
                  <p>
                    No se puede bloquear esta cuenta desde este caso porque la tienda ya fue bloqueada por la mediación <strong>{blockingCode}</strong>. Esta mediación puede continuar su curso, pero la acción de bloqueo queda inhabilitada.
                  </p>
                </div>
              ) : null}

              <label className="mediation-action-field">
                <span>Fundamento / resolución *</span>
                <p>Explica el análisis y la decisión tomada. Este campo es obligatorio.</p>
                <textarea
                  value={resolutionReason}
                  onChange={(event) => setResolutionReason(event.target.value)}
                  placeholder="Describe el fundamento de tu decisión..."
                  rows={5}
                />
                <small>{resolutionReason.length} / 2000</small>
              </label>

              <label className="mediation-upload-card">
                <span className="mediation-upload-title">Documento acreditador *</span>
                <p>Adjunta un documento que respalde tu decisión. Este campo es obligatorio.</p>
                <div className="mediation-upload-dropzone">
                  <UiIcon name="upload" />
                  <div>
                    <strong>Arrastra tu archivo aquí o selecciona un archivo</strong>
                    <span>PDF, JPG, PNG hasta 10 MB</span>
                  </div>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={handleDocumentChange} />
                </div>
                {documentFile ? <small className="mediation-upload-name">{documentFile.name}</small> : null}
              </label>

              <div className="mediation-actions-note">
                <UiIcon name="info" />
                <p>Para resolver o bloquear la cuenta, debes adjuntar un texto y un documento.</p>
              </div>
            </section>
          </section>

          <section className="mediation-resolution-summary mediation-notes-summary">
            <div className="mediation-resolution-summary-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UiIcon name="document" />
                <strong>Historial de reportes</strong>
              </div>
              <select
                className="select compact"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '6px', cursor: 'pointer' }}
                aria-label="Filtrar reportes"
              >
                <option value="all">Todos los reportes</option>
                <option value="seller">Reportes al Vendedor</option>
                <option value="buyer">Reportes al Comprador</option>
              </select>
            </div>
            {filteredHistory.length ? (
              <div className="mediation-notes-list">
                {filteredHistory.map((entry) => {
                  const tone = entry.reportedParty === 'COMPRADOR' ? 'orange' : 'blue';
                  const icon = entry.reportedParty === 'COMPRADOR' ? 'user' : 'users';
                  const isUserReport = entry.source === 'Reporte de Usuario';
                  return (
                    <article className={`mediation-note-item ${tone}`} key={entry.id}>
                      <span className={`mediation-note-item-icon ${tone}`}>
                        <UiIcon name={icon} />
                      </span>
                      <div className="mediation-note-item-body">
                        <div className="mediation-note-item-head">
                          <strong>{entry.reportedParty === 'COMPRADOR' ? 'Reporte al Comprador' : 'Reporte al Vendedor'}</strong>
                          <time>{formatDateTime(entry.date)}</time>
                        </div>
                        <p style={{ fontWeight: 650, fontSize: '13px', marginTop: '2px', marginBottom: '6px', color: '#1e293b' }}>
                          {entry.title}
                        </p>
                        <p style={{ whiteSpace: 'pre-line' }}>{entry.text}</p>
                        <small>
                          {entry.author} · {isUserReport ? 'Reporte de Usuario' : 'Canal de Ayuda'}
                        </small>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mediation-notes-empty">
                <UiIcon name="document" />
                <p>No se encontraron reportes con el filtro seleccionado.</p>
              </div>
            )}
          </section>

          <div className="mediation-management-footer">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="secondary-button" type="button" disabled={!resolutionReason.trim() && !documentFile}>
              Guardar borrador
            </button>
            <div className="mediation-management-footer-actions">
              <button className="primary-button" type="button" onClick={handleResolve} disabled={decision !== 'resolve' || !resolutionReason.trim() || !documentFile}>
                <UiIcon name="check" /> Resolver caso
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => onBlockAccount(item.id)}
                disabled={decision !== 'block' || !canBlockSeller}
              >
                <UiIcon name="shieldX" /> Bloquear tienda
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
