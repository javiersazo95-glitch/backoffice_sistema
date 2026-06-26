import { useEffect, useState, type ChangeEvent } from 'react';
import { MediationResponse, MediationStatus, type MediationDetailResponse, type MediationEvidenceResponse, type MediationMessageResponse } from '@/types/mediation';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { formatCurrency, mediationStatusDisplay } from '@/utils/formatters';

type MediationModalItem = MediationResponse & Partial<Pick<MediationDetailResponse, 'messages' | 'buyerMessages' | 'sellerMessages' | 'buyerEvidence' | 'sellerEvidence' | 'resolutionReason' | 'documentName' | 'documentUrl' | 'documentType' | 'buyer'>>;

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
    aligned: message.senderRole === 'MEDIADOR' ? (side === 'buyer' ? 'right' : 'left') : (side === 'buyer' ? 'left' : 'right'),
    label: message.senderRole === 'MEDIADOR' ? 'Mediador' : message.senderRole === 'SISTEMA' ? 'Sistema' : side === 'buyer' ? 'Comprador' : 'Vendedor',
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

function ChatBubble({ message, accent }: { message: ChatMessage; accent: 'blue' | 'violet' }) {
  return (
    <div className={`chat-bubble ${message.aligned === 'left' ? 'incoming' : 'outgoing'} ${accent}`}>
      <div className="chat-bubble-meta">
        <strong>{message.label}</strong>
        <span>{message.author}</span>
      </div>
      <p>{message.text}</p>
      <span>{message.time}</span>
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
  messages,
  accent,
  placeholder,
  onSend,
  disabled,
}: {
  title: string;
  partyName: string;
  icon: string;
  messages: ChatMessage[];
  accent: 'blue' | 'violet';
  placeholder: string;
  onSend: (value: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

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
            <UiIcon name={icon} />
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
          messages.map((message) => <ChatBubble key={message.id} message={message} accent={accent} />)
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

  useEffect(() => {
    if (!isOpen) return;
    setResolutionReason('');
    setDocumentFile(null);
    setDecision('resolve');
  }, [isOpen, item?.id]);

  const buyerName = item ? resolveBuyerName(item) : 'Comprador';
  const sellerName = item?.sellerName || 'Vendedor';
  const canBlockSeller = item?.canBlockAccount !== false && !item?.accountBlocked;
  const blockingCode = item?.blockingMediationExternalId || (item?.blockingMediationId ? `MED-${item.blockingMediationId}` : '');

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
                <small>Vendedor</small>
                <strong>{sellerName}</strong>
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
                  <h3>Evidencias de comprador y vendedor</h3>
                </div>
                <p>Archivos adjuntados por cada parte durante la conversación.</p>
              </div>
              <div className="mediation-evidence-grid">
                <EvidenceSection title="Evidencias del comprador" partyName={buyerName} evidence={item.buyerEvidence ?? []} accent="blue" />
                <EvidenceSection title="Evidencias del vendedor" partyName={sellerName} evidence={item.sellerEvidence ?? []} accent="violet" />
              </div>
            </section>

            <ChatCard
              title="Chat con comprador"
              partyName={buyerName}
              icon="users"
              messages={mapBackendMessages(item.buyerMessages, 'buyer')}
              accent="blue"
              placeholder="Aún no hay mensajes en este chat."
              onSend={(value) => item?.id && onSendMessage(item.id, value, 'COMPRADOR')}
              disabled={item.status === MediationStatus.RESUELTA || item.accountBlocked || item.buyerMessages?.some((m) => m.closed)}
            />

            <ChatCard
              title="Chat con vendedor"
              partyName={sellerName}
              icon="users"
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
                    <strong>Bloquear cuenta del vendedor</strong>
                    <p>
                      {canBlockSeller
                        ? 'Suspende la cuenta del vendedor.'
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
                    No se puede bloquear esta cuenta desde este caso porque el vendedor ya fue bloqueado por la mediación <strong>{blockingCode}</strong>. Esta mediación puede continuar su curso, pero la acción de bloqueo queda inhabilitada.
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

          <section className="mediation-resolution-summary">
            <div className="mediation-resolution-summary-head">
              <UiIcon name="info" />
              <strong>
                {decision === 'resolve'
                  ? 'Al resolver el caso, se notificará al comprador y al vendedor sobre la resolución.'
                  : 'Si eliges bloquear la cuenta, el vendedor quedará suspendido en la plataforma.'}
              </strong>
            </div>
            <ul>
              <li>El comprador recibirá el detalle de la decisión por correo y en su cuenta.</li>
              <li>El vendedor recibirá el detalle de la decisión por correo y en su cuenta.</li>
              {decision === 'block' ? (
                <li className="danger">La cuenta del vendedor quedará bloqueada hasta una reactivación posterior.</li>
              ) : (
                <li>El caso quedará cerrado dentro del flujo de mediación.</li>
              )}
            </ul>
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
                <UiIcon name="shieldX" /> Bloquear vendedor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
