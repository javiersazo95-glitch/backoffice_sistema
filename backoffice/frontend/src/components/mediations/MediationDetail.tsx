import { useEffect, useState, useMemo, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MediationResponse,
  MediationStatus,
  type MediationDetailResponse,
  type MediationEvidenceResponse,
  type MediationMessageResponse,
  type MediationSuspendPayload,
  type SuspensionDuration,
} from '@/types/mediation';
import { useMediation, useResolveCase, useBlockAccount, useAddMessage } from '@/hooks/useMediations';
import { showToast } from '@/components/layout/Toast';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import { formatCurrency, formatDateTime, mediationStatusDisplay } from '@/utils/formatters';
import {
  buildRefundSteps,
  buildVeredictoPreview,
  findResolutionOption,
  refundStatusView,
  resolutionOptionsFor,
  resolutionOptionLabel,
  type MediationFavor,
} from '@/utils/mediationResolution';
import { getReports } from '@/api/reports';
import { downloadDocument, previewDocument, resolveNavigableDocumentUrl } from '@/utils/documentUrls';
import { resolveProfileImageUrl } from '@/api/client';
import mediatorProfileImage from '@/assets/mediator-profile.jpg';

type MediationModalItem = MediationResponse & Partial<MediationDetailResponse>;

export interface MediationDetailProps {
  isOpen?: boolean;
  item?: MediationModalItem | null;
  onClose?: () => void;
  onBack?: () => void;
  onResolve?: (id: number, payload: MediationResolvePayload) => void;
  onBlockAccount?: (id: number, payload?: MediationSuspendPayload) => void;
  onSendMessage?: (mediationId: number, text: string, targetRole: string) => void;
}

export const SUSPENSION_DURATIONS: Array<{ key: SuspensionDuration; label: string; days?: number; months?: number; canAppeal: boolean }> = [
  { key: '3_DIAS', label: '3 días', days: 3, canAppeal: false },
  { key: '7_DIAS', label: '7 días', days: 7, canAppeal: false },
  { key: '15_DIAS', label: '15 días', days: 15, canAppeal: false },
  { key: '1_MES', label: '1 mes', months: 1, canAppeal: false },
  { key: '3_MESES', label: '3 meses', months: 3, canAppeal: false },
  { key: 'INDEFINIDO', label: 'Indefinido con derecho a apelación', canAppeal: true },
];

export function formatUnlockDate(duration: SuspensionDuration): string {
  const date = new Date();
  if (duration === '3_DIAS') date.setDate(date.getDate() + 3);
  else if (duration === '7_DIAS') date.setDate(date.getDate() + 7);
  else if (duration === '15_DIAS') date.setDate(date.getDate() + 15);
  else if (duration === '1_MES') date.setMonth(date.getMonth() + 1);
  else if (duration === '3_MESES') date.setMonth(date.getMonth() + 3);
  else return 'Indefinido (hasta que se resuelva una apelación formal)';
  return date.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export interface SuspensionReasonOption {
  key: string;
  label: string;
  defaultText: string;
}

export const COMMON_SUSPENSION_REASONS_SELLER: SuspensionReasonOption[] = [
  {
    key: 'repuesto_incompatible_defectuoso',
    label: '1. Repuesto incompatible o con fallas técnicas',
    defaultText: 'Entrega reiterada de repuestos incompatibles, defectuosos o sin correspondencia con las especificaciones publicadas en el catálogo.',
  },
  {
    key: 'incumplimiento_despacho',
    label: '2. Incumplimiento reiterado de plazos de despacho',
    defaultText: 'Demora excesiva y no justificada en la preparación y entrega del pedido al transporte comprometido.',
  },
  {
    key: 'falta_respuesta_mediacion',
    label: '3. Falta de respuesta y colaboración en la mediación',
    defaultText: 'Falta reiterada de respuesta a los requerimientos del mediador y desatención al comprador durante el proceso de mediación.',
  },
  {
    key: 'negativa_garantia_devolucion',
    label: '4. Negativa injustificada a cumplir garantía o devolución',
    defaultText: 'Rechazo injustificado a aceptar la devolución del repuesto o hacer efectiva la garantía legal conforme a la Ley N° 19.496.',
  },
  {
    key: 'conducta_inapropiada',
    label: '5. Conducta inadecuada o trato irrespetuoso',
    defaultText: 'Uso de lenguaje inapropiado, ofensivo o conductas contrarias a las políticas de convivencia y términos de servicio de la plataforma.',
  },
  {
    key: 'publicacion_enganosa',
    label: '6. Publicación engañosa o información inexacta de stock',
    defaultText: 'Publicación reiterada de piezas sin disponibilidad efectiva, alteración de precios o información confusa sobre el estado real del producto.',
  },
  {
    key: 'otro',
    label: '7. Otro motivo (especificar motivo personalizado)',
    defaultText: '',
  },
];

export const COMMON_SUSPENSION_REASONS_BUYER: SuspensionReasonOption[] = [
  {
    key: 'falta_respuesta_mediacion',
    label: '1. Falta de respuesta y colaboración en la mediación',
    defaultText: 'Falta reiterada de respuesta y desatención a las solicitudes y requerimientos formulados por el mediador durante el caso.',
  },
  {
    key: 'reclamo_fraudulento',
    label: '2. Reclamo infundado o manipulación de antecedentes',
    defaultText: 'Presentación de reclamos falsos, manipulación indebida de evidencias o intento ilegítimo de retención de fondos o reembolsos.',
  },
  {
    key: 'devolucion_danada_incompleta',
    label: '3. Devolución de repuesto dañado, incompleto o adulterado',
    defaultText: 'Devolución de la pieza en condiciones diferentes a las recibidas, con signos de manipulación forzada, daño imputable o faltantes.',
  },
  {
    key: 'conducta_inapropiada',
    label: '4. Conducta inadecuada o trato irrespetuoso',
    defaultText: 'Uso de lenguaje ofensivo, hostigamiento o trato inadecuado hacia la tienda vendedora o el equipo de soporte de la plataforma.',
  },
  {
    key: 'rechazo_injustificado_entrega',
    label: '5. Rechazo reiterado e injustificado de recepciones',
    defaultText: 'Rechazo sistemático y no justificado a recibir entregas válidamente coordinadas con el transporte.',
  },
  {
    key: 'uso_abusivo_garantias',
    label: '6. Uso abusivo de aperturas de disputa o garantías',
    defaultText: 'Reiteración indebida de reclamos sobre compras recibidas conforme, afectando la operativa de la plataforma.',
  },
  {
    key: 'otro',
    label: '7. Otro motivo (especificar motivo personalizado)',
    defaultText: '',
  },
];

export interface MediationResolvePayload {
  favor: MediationFavor;
  resolutionOption: string;
  refundPercentage?: number;
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
            // Las evidencias las suben el comprador y el vendedor, asi que file.url es un dato de
            // tercero. Solo se enlaza si la sirve nuestro backend: enlazar a otro host convertiria
            // el expediente de mediacion en un trampolin con la marca del backoffice detras.
            const href = resolveNavigableDocumentUrl(file.url);
            return (
              <div className="mediation-evidence-file" key={file.id}>
                <span className="mediation-evidence-file-icon"><UiIcon name="document" /></span>
                <div className="mediation-evidence-file-copy">
                  <strong>{name}</strong>
                  <small>{file.uploadedAt ? new Date(file.uploadedAt).toLocaleString('es-CL') : file.mimeType || 'Documento de evidencia'}</small>
                </div>
                <div className="mediation-evidence-actions">
                  {href ? (
                    <>
                      {/* fetch + blob: /api/v1/uploads/r2/** exige el token y un <a href> no lo lleva (O12). */}
                      <button type="button" onClick={() => void previewDocument(href)} aria-label={`Abrir ${name}`} title="Abrir evidencia">
                        <UiIcon name="eye" />
                      </button>
                      <button type="button" onClick={() => void downloadDocument(href, name)} aria-label={`Descargar ${name}`} title="Descargar evidencia">
                        <UiIcon name="download" />
                      </button>
                    </>
                  ) : (
                    <span title="Evidencia de origen externo: no se puede abrir desde el backoffice">
                      <UiIcon name="alert" />
                    </span>
                  )}
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
  banner,
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
  banner?: ReactNode;
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

      {banner ? <div className="mediation-chat-banner">{banner}</div> : null}

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

function RefundStepsPanel({ item }: { item: MediationModalItem }) {
  const status = refundStatusView(item.estadoReembolso);
  const monto = item.montoReembolso ? formatCurrency(item.montoReembolso) : undefined;
  const steps = buildRefundSteps({
    percentage: item.porcentajeReembolso,
    monto,
    orderId: item.orderId,
  });
  const toneColor = status.tone === 'success' ? '#15803d' : status.tone === 'warning' ? '#b45309' : '#1d4ed8';

  return (
    <div className="mediation-refund-steps" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <strong style={{ fontSize: '12.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <UiIcon name="wallet" /> Reembolso a favor del comprador
        </strong>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: toneColor,
            background: `${toneColor}14`,
            borderRadius: '999px',
            padding: '2px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {status.label}
        </span>
      </div>
      <span style={{ fontSize: '12px', color: '#475569' }}>
        {resolutionOptionLabel(item.resolucionOpcion)}
        {item.porcentajeReembolso ? ` · ${item.porcentajeReembolso}%` : ''}
        {monto ? ` · ${monto}` : ''}
      </span>
      <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {steps.map((step, index) => (
          <li key={index} style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function MediationDetail({
  isOpen,
  item: propItem,
  onClose,
  onBack,
  onResolve,
  onBlockAccount,
  onSendMessage,
}: MediationDetailProps) {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const parsedId = paramId ? Number(paramId) : null;
  const effectiveId = propItem?.id ?? (parsedId && Number.isFinite(parsedId) ? parsedId : 0);

  const { data: fetchedMediation, isLoading: isLoadingMediation } = useMediation(effectiveId);
  const item = (propItem ?? fetchedMediation) as MediationModalItem | undefined;

  const isViewOpen = isOpen ?? true;

  const resolveMutation = useResolveCase();
  const blockMutation = useBlockAccount();
  const addMessageMutation = useAddMessage();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (onClose) {
      onClose();
    } else {
      navigate('/confianza/mediations');
    }
  };

  const handleSendMessage = (mediationId: number, text: string, targetRole: string) => {
    if (onSendMessage) {
      onSendMessage(mediationId, text, targetRole);
    } else {
      addMessageMutation.mutate({
        mediationId,
        data: { message: text, targetRole },
      });
    }
  };

  const handleInternalResolve = (id: number, payload: MediationResolvePayload) => {
    if (onResolve) {
      onResolve(id, payload);
    } else {
      resolveMutation.mutate(
        {
          id,
          data: {
            favor: payload.favor,
            resolutionOption: payload.resolutionOption,
            refundPercentage: payload.refundPercentage,
          },
        },
        {
          onSuccess: () => {
            showToast('Caso resuelto');
            navigate('/confianza/mediations');
          },
          onError: (error: any) => {
            showToast(error?.response?.data?.message || 'Error al resolver el caso');
          },
        },
      );
    }
  };

  const handleInternalBlockAccount = (id: number, payload?: MediationSuspendPayload) => {
    if (onBlockAccount) {
      onBlockAccount(id, payload);
    } else {
      const targetText = payload?.targetRole === 'COMPRADOR' ? 'la cuenta del comprador' : 'la cuenta de la tienda';
      const confirmMsg = payload
        ? `¿Estás seguro de suspender ${targetText}?`
        : '¿Estás seguro de suspender esta cuenta?';

      if (confirm(confirmMsg)) {
        blockMutation.mutate(
          { id, data: payload },
          {
            onSuccess: () => {
              showToast('Cuenta suspendida con éxito');
              navigate('/confianza/mediations');
            },
            onError: (error: any) => {
              showToast(error?.response?.data?.message || 'No se pudo suspender la cuenta');
            },
          },
        );
      }
    }
  };

  const [decision, setDecision] = useState<'resolve' | 'block'>('resolve');
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [favor, setFavor] = useState<MediationFavor | ''>('');
  const [resolutionOption, setResolutionOption] = useState('');
  const [refundPercentage, setRefundPercentage] = useState('');
  const [suspensionTarget, setSuspensionTarget] = useState<'COMPRADOR' | 'VENDEDOR' | ''>('');
  const [suspensionDuration, setSuspensionDuration] = useState<SuspensionDuration | ''>('');
  const [suspensionReasonKey, setSuspensionReasonKey] = useState<string>('');
  const [suspensionReason, setSuspensionReason] = useState('');
  // O64 (pruebas de lanzamiento, 25-sep): "Resolver caso" pide confirmacion antes de ejecutar.
  // Un reembolso se solicita a Flow en el acto y no tiene vuelta atras.
  const [confirmResolveOpen, setConfirmResolveOpen] = useState(false);

  useEffect(() => {
    if (!isViewOpen) return;
    setConfirmResolveOpen(false);
    setDecision('resolve');
    setHistoryFilter('all');
    setFavor('');
    setResolutionOption('');
    setRefundPercentage('');
    setSuspensionTarget('');
    setSuspensionDuration('');
    setSuspensionReasonKey('');
    setSuspensionReason('');
  }, [isViewOpen, item?.id]);

  const { data: allReportsData } = useQuery({
    queryKey: ['all-reports-for-mediation-detail'],
    queryFn: () => getReports({ size: 1000 }),
    enabled: !!item && isViewOpen,
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

  if (isViewOpen && isLoadingMediation && !item) {
    return (
      <div className="mediation-management-view">
        <div className="mediation-management-shell">
          <div className="mediation-management-header">
            <div className="mediation-management-heading">
              <span className="mediation-management-icon">
                <UiIcon name="scale" />
              </span>
              <div className="mediation-management-title">
                <h2>Gestionar mediación</h2>
              </div>
            </div>
            <button className="secondary-button mediation-back-button" type="button" onClick={handleBack}>
              <UiIcon name="arrowLeft" />
              <span>Volver atrás</span>
            </button>
          </div>
          <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p>Cargando información del caso de mediación...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isViewOpen || !item) {
    if (isViewOpen && !isLoadingMediation) {
      return (
        <div className="mediation-management-view">
          <div className="mediation-management-shell">
            <div className="mediation-management-header">
              <div className="mediation-management-heading">
                <span className="mediation-management-icon">
                  <UiIcon name="scale" />
                </span>
                <div className="mediation-management-title">
                  <h2>Gestionar mediación</h2>
                </div>
              </div>
              <button className="secondary-button mediation-back-button" type="button" onClick={handleBack}>
                <UiIcon name="arrowLeft" />
                <span>Volver atrás</span>
              </button>
            </div>
            <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p>No se encontró el caso de mediación solicitado.</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  const initializationReason = resolveInitializationReason(item);

  const favorOptions = favor ? resolutionOptionsFor(favor) : [];
  const selectedOption = findResolutionOption(resolutionOption);
  const parsedPercentage = Number.parseInt(refundPercentage, 10);
  const percentageValid =
    !selectedOption?.requiresPercentage ||
    (Number.isFinite(parsedPercentage) && parsedPercentage >= 1 && parsedPercentage <= 100);
  const veredictoReady =
    !!favor && !!selectedOption && selectedOption.favor === favor && percentageValid;
  const resolveReady = veredictoReady;

  const handleFavorChange = (next: MediationFavor) => {
    setFavor(next);
    setResolutionOption('');
    setRefundPercentage('');
  };

  // O64: a quien favorece el veredicto y, si hay reembolso, cuanto. El monto exacto lo calcula
  // el backend sobre lo comprado en la tienda (lineas + envio, tope el total del pedido), asi que
  // aca solo se puede dar el tope: el total del caso por el porcentaje.
  const favorPartyName = favor === 'COMPRADOR' ? buyerName : favor === 'VENDEDOR' ? `la tienda ${sellerName}` : '';
  const confirmRefundPercentage = selectedOption?.appliesRefund
    ? (selectedOption.requiresPercentage ? (percentageValid ? parsedPercentage : 0) : 100)
    : 0;
  const confirmRefundCap = confirmRefundPercentage > 0 && Number(item.amount) > 0
    ? Math.round((Number(item.amount) * confirmRefundPercentage) / 100)
    : 0;

  const requestResolve = () => {
    if (decision !== 'resolve' || !resolveReady || !favor || !selectedOption || !item) return;
    setConfirmResolveOpen(true);
  };

  const handleResolve = () => {
    if (decision !== 'resolve' || !resolveReady || !favor || !selectedOption || !item) return;
    setConfirmResolveOpen(false);
    handleInternalResolve(item.id, {
      favor,
      resolutionOption: selectedOption.key,
      refundPercentage: selectedOption.requiresPercentage ? parsedPercentage : undefined,
    });
  };

  const handleTargetChange = (nextTarget: 'COMPRADOR' | 'VENDEDOR') => {
    setSuspensionTarget(nextTarget);
    setSuspensionReasonKey('');
    setSuspensionReason('');
  };

  const handleReasonKeyChange = (key: string) => {
    setSuspensionReasonKey(key);
    if (!key) {
      setSuspensionReason('');
      return;
    }
    if (key === 'otro') {
      setSuspensionReason('');
    } else {
      const list =
        suspensionTarget === 'COMPRADOR'
          ? COMMON_SUSPENSION_REASONS_BUYER
          : COMMON_SUSPENSION_REASONS_SELLER;
      const found = list.find((item) => item.key === key);
      if (found) {
        setSuspensionReason(found.defaultText);
      }
    }
  };

  const selectedDuration = SUSPENSION_DURATIONS.find((d) => d.key === suspensionDuration);
  const isSellerDisabled = suspensionTarget === 'VENDEDOR' && !canBlockSeller;
  const suspendReady = Boolean(
    decision === 'block' &&
    suspensionTarget &&
    suspensionDuration &&
    suspensionReasonKey &&
    suspensionReason.trim().length >= 5 &&
    !isSellerDisabled
  );

  const handleSuspend = () => {
    if (!suspendReady || !item || !suspensionTarget || !suspensionDuration) return;
    handleInternalBlockAccount(item.id, {
      targetRole: suspensionTarget,
      duration: suspensionDuration,
      reason: suspensionReason.trim(),
      details: suspensionReason.trim(),
    });
  };

  return (
    <div className="mediation-management-view">
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

          <button className="secondary-button mediation-back-button" type="button" onClick={handleBack}>
            <UiIcon name="arrowLeft" />
            <span>Volver atrás</span>
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
              onSend={(value) => item?.id && handleSendMessage(item.id, value, 'COMPRADOR')}
              disabled={item.status === MediationStatus.RESUELTA || item.accountBlocked || item.buyerMessages?.some((m) => m.closed)}
              banner={
                item.resolucionFavor === 'COMPRADOR' && (item.montoReembolso ?? 0) > 0
                  ? <RefundStepsPanel item={item} />
                  : null
              }
            />

            <ChatCard
              title="Chat con tienda"
              partyName={sellerName}
              icon="users"
              photoUrl={sellerPhotoUrl}
              messages={mapBackendMessages(item.sellerMessages, 'seller')}
              accent="violet"
              placeholder="Aún no hay mensajes en este chat."
              onSend={(value) => item?.id && handleSendMessage(item.id, value, 'VENDEDOR')}
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
                  onClick={() => setDecision('block')}
                >
                  <span className="mediation-choice-radio" />
                  <div>
                    <strong>Suspender cuenta</strong>
                    <p>Aplica una sanción temporal o indefinida a una de las partes.</p>
                  </div>
                  <span className="mediation-choice-action danger">
                    <UiIcon name="shieldX" />
                  </span>
                </button>
              </div>

              {decision === 'resolve' ? (
                <div className="mediation-verdict-block" style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '4px 0 8px' }}>
                  <div>
                    <span className="mediation-init-reason-kicker">Veredicto de la mediación *</span>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 8px' }}>
                      Según la Ley N° 19.496 (Protección de los Derechos de los Consumidores), indica a favor de
                      quién se resuelve y bajo qué figura legal.
                    </p>
                    <div className="mediation-verdict-toggle" style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={`mediation-choice ${favor === 'COMPRADOR' ? 'selected' : ''}`}
                        style={{ flex: 1 }}
                        onClick={() => handleFavorChange('COMPRADOR')}
                      >
                        <span className="mediation-choice-radio" />
                        <div><strong>A favor del comprador</strong></div>
                      </button>
                      <button
                        type="button"
                        className={`mediation-choice ${favor === 'VENDEDOR' ? 'selected' : ''}`}
                        style={{ flex: 1 }}
                        onClick={() => handleFavorChange('VENDEDOR')}
                      >
                        <span className="mediation-choice-radio" />
                        <div><strong>A favor de la tienda</strong></div>
                      </button>
                    </div>
                  </div>

                  {favor ? (
                    <label className="mediation-action-field">
                      <span>Opción de resolución (Ley 19.496) *</span>
                      <select
                        className="select"
                        value={resolutionOption}
                        onChange={(event) => {
                          setResolutionOption(event.target.value);
                          setRefundPercentage('');
                        }}
                      >
                        <option value="">Selecciona una figura legal…</option>
                        {favorOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {selectedOption ? (
                        <small style={{ color: '#64748b' }}>{selectedOption.fundamentoLegal}.</small>
                      ) : null}
                    </label>
                  ) : null}

                  {selectedOption?.requiresPercentage ? (
                    <label className="mediation-action-field">
                      <span>Porcentaje de reembolso *</span>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 6px' }}>
                        Se aplica sobre el subtotal de la compra en la tienda (líneas + envío). El monto exacto lo
                        calcula el sistema.
                      </p>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={100}
                        value={refundPercentage}
                        onChange={(event) => setRefundPercentage(event.target.value)}
                        placeholder="Ej: 50"
                      />
                      {!percentageValid && refundPercentage ? (
                        <small style={{ color: '#dc2626' }}>Ingresa un porcentaje entre 1 y 100.</small>
                      ) : null}
                    </label>
                  ) : selectedOption?.appliesRefund ? (
                    <div className="mediation-actions-note">
                      <UiIcon name="info" />
                      <p>Reembolso íntegro: se devolverá el 100% del subtotal de la compra en la tienda.</p>
                    </div>
                  ) : null}

                  {selectedOption ? (
                    <div className="mediation-blocking-warning" style={{ background: '#f8fafc', borderColor: 'rgba(15,23,42,0.08)' }}>
                      <UiIcon name="scale" />
                      <p style={{ whiteSpace: 'pre-line' }}>
                        {buildVeredictoPreview({
                          favor: favor as MediationFavor,
                          option: selectedOption,
                          refundPercentage: percentageValid ? parsedPercentage : undefined,
                          externalId: item.externalId,
                        })}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {decision === 'block' ? (
                <div className="mediation-verdict-block" style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '4px 0 8px' }}>
                  <div>
                    <span className="mediation-init-reason-kicker">Parte sancionada con suspensión *</span>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 8px' }}>
                      Selecciona a qué parte se le aplicará la suspensión de cuenta.
                    </p>
                    <div className="mediation-verdict-toggle" style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={`mediation-choice ${suspensionTarget === 'COMPRADOR' ? 'selected' : ''}`}
                        style={{ flex: 1 }}
                        onClick={() => handleTargetChange('COMPRADOR')}
                      >
                        <span className="mediation-choice-radio" />
                        <div>
                          <strong>Comprador</strong>
                          <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>{buyerName}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        className={`mediation-choice ${suspensionTarget === 'VENDEDOR' ? 'selected' : ''}`}
                        style={{ flex: 1, opacity: !canBlockSeller ? 0.6 : 1 }}
                        onClick={() => {
                          if (canBlockSeller) handleTargetChange('VENDEDOR');
                        }}
                        disabled={!canBlockSeller}
                      >
                        <span className="mediation-choice-radio" />
                        <div>
                          <strong>Tienda / Vendedor</strong>
                          <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>
                            {sellerName} {!canBlockSeller && blockingCode ? `(Bloqueada por ${blockingCode})` : ''}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {!canBlockSeller && blockingCode && (
                    <div className="mediation-blocking-warning">
                      <UiIcon name="lock" />
                      <p>
                        La cuenta de la tienda ya fue bloqueada por la mediación <strong>{blockingCode}</strong>. No es posible volver a suspender la tienda desde este caso.
                      </p>
                    </div>
                  )}

                  {suspensionTarget ? (
                    <>
                      <label className="mediation-action-field">
                        <span>Duración de la suspensión *</span>
                        <select
                          className="select"
                          value={suspensionDuration}
                          onChange={(event) => setSuspensionDuration(event.target.value as SuspensionDuration)}
                        >
                          <option value="">Selecciona la duración de la suspensión…</option>
                          {SUSPENSION_DURATIONS.map((dur) => (
                            <option key={dur.key} value={dur.key}>
                              {dur.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="mediation-action-field">
                        <span>Motivo de la suspensión *</span>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 6px' }}>
                          Selecciona una de las 6 causas más comunes o elige &ldquo;Otro&rdquo; para redactar un motivo personalizado.
                        </p>
                        <select
                          className="select"
                          value={suspensionReasonKey}
                          onChange={(event) => handleReasonKeyChange(event.target.value)}
                        >
                          <option value="">Selecciona un motivo común…</option>
                          {(suspensionTarget === 'COMPRADOR'
                            ? COMMON_SUSPENSION_REASONS_BUYER
                            : COMMON_SUSPENSION_REASONS_SELLER
                          ).map((opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {suspensionReasonKey ? (
                        <label className="mediation-action-field">
                          <span>
                            {suspensionReasonKey === 'otro'
                              ? 'Motivo y fundamentos de la suspensión *'
                              : 'Detalle del motivo (editable) *'}
                          </span>
                          <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 6px' }}>
                            {suspensionReasonKey === 'otro'
                              ? 'Escribe los antecedentes de la sanción. Este texto será notificado formalmente por correo a la parte afectada.'
                              : 'El texto predeterminado fue cargado automáticamente. Puedes editarlo o complementar antecedentes específicos antes de suspender.'}
                          </p>
                          <textarea
                            className="textarea"
                            rows={3}
                            placeholder={
                              suspensionReasonKey === 'otro'
                                ? 'Describe detalladamente el motivo de la suspensión...'
                                : 'Detalle del motivo de la suspensión...'
                            }
                            value={suspensionReason}
                            onChange={(e) => setSuspensionReason(e.target.value)}
                          />
                          {suspensionReason.trim().length > 0 && suspensionReason.trim().length < 5 ? (
                            <small style={{ color: '#dc2626' }}>El motivo debe contener al menos 5 caracteres.</small>
                          ) : null}
                        </label>
                      ) : null}

                      {suspensionDuration ? (
                        <div className="mediation-blocking-warning" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                          <UiIcon name="shieldX" />
                          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                            <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#991b1b' }}>
                              Resumen de la suspensión a aplicar:
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '18px', color: '#7f1d1d' }}>
                              <li>
                                <strong>Parte sancionada:</strong> {suspensionTarget === 'COMPRADOR' ? `Comprador (${buyerName})` : `Tienda (${sellerName})`}
                              </li>
                              <li>
                                <strong>Plazo seleccionado:</strong> {selectedDuration?.label}
                              </li>
                              <li>
                                <strong>Desbloqueo programado:</strong> {formatUnlockDate(suspensionDuration)}
                              </li>
                              {suspensionReason.trim() ? (
                                <li>
                                  <strong>Motivo a notificar:</strong> {suspensionReason.trim()}
                                </li>
                              ) : null}
                              <li>
                                <strong>Derecho a apelación:</strong>{' '}
                                {suspensionDuration === 'INDEFINIDO'
                                  ? 'Sí. El usuario tendrá habilitada la opción de presentar una apelación formal desde la aplicación.'
                                  : 'No. Las suspensiones temporales no permiten apelación y se reactivan automáticamente al expirar el tiempo establecido.'}
                              </li>
                              <li>
                                <strong>Notificación por correo:</strong> Se enviará un correo formal a la parte sancionada indicando el motivo, plazo y condiciones del desbloqueo.
                              </li>
                            </ul>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="mediation-actions-note">
                <UiIcon name="info" />
                <p>
                  {decision === 'resolve'
                    ? 'Al resolver, el fundamento legal y el mensaje cordial a ambas partes (chat, plataforma, correo y app) se generan automáticamente según la Ley N° 19.496. Si aplica reembolso, se solicita a la pasarela de pagos.'
                    : 'Al suspender, la cuenta quedará inhabilitada temporal o indefinidamente según el plazo seleccionado y se le notificará por correo la decisión tomada por el mediador.'}
                </p>
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
            <button className="secondary-button" type="button" onClick={handleBack}>
              Volver atrás
            </button>
            <button className="secondary-button" type="button" disabled={!favor}>
              Guardar borrador
            </button>
            <div className="mediation-management-footer-actions">
              <button
                className="primary-button"
                type="button"
                onClick={requestResolve}
                disabled={decision !== 'resolve' || !resolveReady || resolveMutation.isPending}
              >
                <UiIcon name="check" /> {resolveMutation.isPending ? 'Resolviendo…' : 'Resolver caso'}
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={handleSuspend}
                disabled={decision !== 'block' || !suspendReady}
              >
                <UiIcon name="shieldX" /> Suspender cuenta
              </button>
            </div>
          </div>
        </div>

        {/* O64 (pruebas de lanzamiento, 25-sep): confirmacion antes de resolver. Mismo molde que
            el dialogo de "Rechazar expediente" en validaciones (modal-backdrop / modal-panel). */}
        {confirmResolveOpen && selectedOption ? (
          <div className="modal-backdrop" onClick={() => setConfirmResolveOpen(false)}>
            <div
              className="modal-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-resolve-title"
              style={{ width: 'min(520px, 95%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title-block">
                  <h2 id="confirm-resolve-title" style={{ color: confirmRefundPercentage > 0 ? '#b45309' : undefined }}>
                    ¿Resolver a favor de {favorPartyName}?
                  </h2>
                  <p>Caso {item.externalId} &bull; {selectedOption.label}</p>
                </div>
                <button className="icon-button" type="button" onClick={() => setConfirmResolveOpen(false)} aria-label="Cerrar">
                  <UiIcon name="close" />
                </button>
              </div>

              <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                <div
                  style={{
                    padding: '12px 14px',
                    background: confirmRefundPercentage > 0 ? '#fffbeb' : '#f8fafc',
                    border: `1px solid ${confirmRefundPercentage > 0 ? '#fde68a' : '#e2e8f0'}`,
                    borderRadius: 8,
                    color: confirmRefundPercentage > 0 ? '#92400e' : '#334155',
                    fontSize: 12.5,
                    lineHeight: 1.45,
                  }}
                >
                  {confirmRefundPercentage > 0
                    ? confirmRefundCap > 0
                      ? `Se solicitará a Flow un reembolso de hasta ${formatCurrency(confirmRefundCap)} al comprador (${confirmRefundPercentage}% de lo comprado en la tienda; el monto exacto lo calcula el sistema). Esta acción no se puede deshacer.`
                      : `Se solicitará a Flow un reembolso del ${confirmRefundPercentage}% de lo comprado en la tienda al comprador. Esta acción no se puede deshacer.`
                    : 'Se cerrará el caso y se notificará el veredicto a ambas partes. No se solicitará ningún reembolso. Esta acción no se puede deshacer.'}
                </div>
              </div>

              <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="secondary-button" type="button" onClick={() => setConfirmResolveOpen(false)}>
                  Cancelar
                </button>
                <button
                  className="primary-button"
                  type="button"
                  style={confirmRefundPercentage > 0 ? { background: '#d97706', borderColor: '#b45309' } : undefined}
                  onClick={handleResolve}
                  disabled={resolveMutation.isPending}
                >
                  {confirmRefundPercentage > 0 ? 'Sí, resolver y reembolsar' : 'Sí, resolver caso'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
}
