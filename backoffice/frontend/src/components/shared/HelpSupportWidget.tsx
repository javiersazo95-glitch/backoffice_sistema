import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import * as supportApi from '@/api/support';
import type { TicketCategory, TicketPriority, TicketPlatform } from '@/api/support';
import UiIcon from './UiIcon';
import { showToast } from '@/components/layout/Toast';

export default function HelpSupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'help' | 'report'>('help');
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Determine current platform based on route
  const currentPlatformInfo = useMemo<{
    id: TicketPlatform;
    name: string;
    faqs: { q: string; a: string }[];
  }>(() => {
    const path = location.pathname;
    if (path.includes('/administracion')) {
      return {
        id: 'ADMINISTRACION_CONTABLE',
        name: 'Administración Contable',
        faqs: [
          {
            q: '¿Cómo conciliar movimientos?',
            a: 'Ve a la sección Gastos o Liquidaciones, sube tu planilla CSV de transacciones bancarias, y utiliza la verificación automática.',
          },
          {
            q: '¿Cuándo se liberan los fondos a tiendas?',
            a: 'Las liquidaciones semanales se calculan y consolidan automáticamente cada lunes para todas las órdenes en estado "Completados".',
          },
          {
            q: '¿Cómo registrar retiros de socios?',
            a: 'En la sección de Retiros de Socios, haz clic en "Registrar retiro". Asegúrate de que el monto no exceda el cupo máximo disponible.',
          },
        ],
      };
    } else if (path.includes('/confianza')) {
      return {
        id: 'MEDIACION_CONFIANZA',
        name: 'Mediación y Confianza',
        faqs: [
          {
            q: '¿Cómo validar un vendedor nuevo?',
            a: 'Ingresa a Validaciones, revisa los documentos cargados (RUT, Patente) y verifica que la información tributaria y RUT coincidan.',
          },
          {
            q: '¿Cuándo se escala una mediación?',
            a: 'Si un vendedor no responde al reclamo del comprador tras 3 días hábiles, el caso se escala para intervención del mediador.',
          },
          {
            q: '¿Cómo bloquear una cuenta sospechosa?',
            a: 'Abre la ficha del vendedor desde Perfiles y selecciona "Suspender cuenta". El sistema bloqueará sus retiros y operaciones.',
          },
        ],
      };
    }
    return {
      id: 'APP_MOBILE',
      name: 'App Mobile RepuesTop',
      faqs: [
        {
          q: '¿Cómo reportar errores generales?',
          a: 'Describe la falla en el formulario de abajo indicando los pasos para reproducir el bug y su nivel de impacto.',
        },
      ],
    };
  }, [location.pathname]);

  // Form states
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('FALLA_TECNICA');
  const [priority, setPriority] = useState<TicketPriority>('MEDIA');
  const [reporterName, setReporterName] = useState(user?.fullName || 'Operador Interno');

  const createMutation = useMutation({
    mutationFn: supportApi.createTicket,
    onSuccess: () => {
      // Invalidate queries so support dashboard updates
      queryClient.invalidateQueries({ queryKey: ['support-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-global'] });
      
      showToast('Falla reportada exitosamente a Soporte');
      setIsOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error al enviar reporte de soporte');
    },
  });

  const resetForm = () => {
    setReason('');
    setDescription('');
    setCategory('FALLA_TECNICA');
    setPriority('MEDIA');
    setView('help');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !description.trim()) {
      showToast('Por favor completa todos los campos obligatorios');
      return;
    }

    createMutation.mutate({
      reason,
      lastMessage: description,
      category,
      priority,
      reporterType: 'INTERNO',
      reporterName,
      sellerId: null,
      platform: currentPlatformInfo.id,
    });
  };

  return (
    <>
      {/* CSS Styles injection for self-containment */}
      <style>{`
        .help-widget-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 8px;
          height: 48px;
          padding: 0 18px;
          border: none;
          border-radius: 24px;
          background: var(--blue);
          color: white;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .help-widget-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.4);
          background: #1d4ed8;
        }
        .help-widget-btn svg {
          width: 18px;
          height: 18px;
          stroke: white;
        }

        .help-widget-panel {
          position: fixed;
          bottom: 84px;
          right: 24px;
          width: 380px;
          max-height: 520px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          background: white;
          border: 1px solid var(--line);
          border-radius: 16px;
          box-shadow: 0 12px 36px rgba(15, 23, 42, 0.15);
          overflow: hidden;
          animation: helpSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes helpSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .help-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: linear-gradient(135deg, #0c1d31 0%, #071522 100%);
          color: white;
        }
        .help-panel-header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .help-panel-header span {
          font-size: 11px;
          opacity: 0.75;
          display: block;
          margin-top: 2px;
        }
        .help-close-btn {
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .help-close-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }
        .help-close-btn svg {
          width: 16px;
          height: 16px;
        }

        .help-panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .help-faq-section {
          margin-bottom: 20px;
        }
        .help-faq-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--muted);
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }
        .help-faq-item {
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--soft-line);
        }
        .help-faq-item:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .help-faq-q {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .help-faq-a {
          font-size: 12.5px;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .help-panel-footer {
          padding: 16px 20px;
          border-top: 1px solid var(--line);
          background: var(--soft);
          display: flex;
          justify-content: stretch;
        }
        .help-report-trigger-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 38px;
          background: #fff0ef;
          border: 1px solid #fecdd3;
          color: #dc2626;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .help-report-trigger-btn:hover {
          background: #ffe4e6;
          border-color: #fda4af;
        }
        .help-report-trigger-btn svg {
          width: 16px;
          height: 16px;
        }

        /* Form styling */
        .help-form-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 13px;
          color: var(--blue);
          cursor: pointer;
          font-weight: 600;
        }
        .help-form-header svg {
          width: 16px;
          height: 16px;
        }
        .help-form-group {
          margin-bottom: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .help-form-group label {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink);
        }
        .help-input, .help-select, .help-textarea {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid var(--line);
          border-radius: 6px;
          font-size: 13px;
          outline: none;
          background: white;
        }
        .help-input:focus, .help-select:focus, .help-textarea:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }
        .help-input-readonly {
          background: var(--soft);
          color: var(--text-secondary);
          border-color: var(--line);
          cursor: not-allowed;
        }
        .help-form-submit-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 38px;
          background: var(--blue);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
        }
        .help-form-submit-btn:hover {
          background: #1d4ed8;
        }
        .help-form-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

      {/* Floating button */}
      <button className="help-widget-btn" type="button" onClick={() => setIsOpen((prev) => !prev)}>
        <UiIcon name={isOpen ? 'close' : 'help'} />
        {isOpen ? 'Cerrar' : 'Ayuda'}
      </button>

      {/* Floating panel drawer */}
      {isOpen && (
        <article className="help-widget-panel">
          <header className="help-panel-header">
            <div>
              <h3>Ayuda e Incidencias</h3>
              <span>Plataforma: {currentPlatformInfo.name}</span>
            </div>
            <button className="help-close-btn" type="button" onClick={() => setIsOpen(false)} aria-label="Cerrar panel">
              <UiIcon name="close" />
            </button>
          </header>

          <div className="help-panel-body">
            {view === 'help' ? (
              /* VIEW: HELP / FAQ */
              <div className="help-faq-section">
                <h4 className="help-faq-title">Preguntas Frecuentes</h4>
                {currentPlatformInfo.faqs.map((faq, index) => (
                  <div className="help-faq-item" key={index}>
                    <strong className="help-faq-q">
                      <UiIcon name="check" style={{ width: 14, height: 14, color: 'var(--blue)' }} />
                      {faq.q}
                    </strong>
                    <p className="help-faq-a">{faq.a}</p>
                  </div>
                ))}
              </div>
            ) : (
              /* VIEW: REPORT BUG FORM */
              <form onSubmit={handleSubmit}>
                <div className="help-form-header" onClick={() => setView('help')}>
                  <UiIcon name="arrowLeft" />
                  <span>Volver a preguntas frecuentes</span>
                </div>

                <div className="help-form-group">
                  <label>Plataforma Origen</label>
                  <input
                    type="text"
                    className="help-input help-input-readonly"
                    value={currentPlatformInfo.name}
                    readOnly
                  />
                </div>

                <div className="help-form-group">
                  <label>Reportante (Tú)</label>
                  <input
                    type="text"
                    className="help-input"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    required
                  />
                </div>

                <div className="help-form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label>Categoría</label>
                    <select
                      className="help-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as TicketCategory)}
                    >
                      <option value="FALLA_TECNICA">Falla Técnica</option>
                      <option value="SOLICITUD_AYUDA">Ayuda</option>
                      <option value="CONSULTA">Consulta</option>
                    </select>
                  </div>
                  <div>
                    <label>Prioridad</label>
                    <select
                      className="help-select"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TicketPriority)}
                    >
                      <option value="CRITICA">Crítica</option>
                      <option value="ALTA">Alta</option>
                      <option value="MEDIA">Media</option>
                      <option value="BAJA">Baja</option>
                    </select>
                  </div>
                </div>

                <div className="help-form-group">
                  <label>Asunto o Título del Reporte</label>
                  <input
                    type="text"
                    className="help-input"
                    placeholder="Ej. Error al validar RUT comercial"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                </div>

                <div className="help-form-group">
                  <label>Descripción del Problema</label>
                  <textarea
                    className="help-textarea"
                    placeholder="Describe los pasos para reproducir o los detalles de tu consulta..."
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <button
                  className="help-form-submit-btn"
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  <UiIcon name="check" />
                  {createMutation.isPending ? 'Enviando...' : 'Enviar Reporte a Soporte'}
                </button>
              </form>
            )}
          </div>

          {view === 'help' && (
            <footer className="help-panel-footer">
              <button className="help-report-trigger-btn" type="button" onClick={() => setView('report')}>
                <UiIcon name="alert" />
                Reportar Falla o Incidencia
              </button>
            </footer>
          )}
        </article>
      )}
    </>
  );
}
