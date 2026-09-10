import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserSummaryResponse } from '@/types/auth';
import UiIcon from '@/components/shared/UiIcon';
import * as notifApi from '@/api/notifications';

interface NotificationBellProps {
  user: UserSummaryResponse | null;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Recién';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationBell({ user }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count', userId],
    queryFn: () => notifApi.getUnreadCount(userId!),
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications-list', userId],
    queryFn: () => notifApi.getNotifications(userId!),
    enabled: !!userId,
    refetchInterval: open ? 15000 : 60000,
  });

  const markReadMutation = useMutation({
    mutationFn: (notifId: number) => notifApi.markAsRead(userId!, notifId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list', userId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notifApi.markAllAsRead(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list', userId] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const handleSelectNotification = (notif: notifApi.NotificacionItem) => {
    if (!notif.leida) {
      markReadMutation.mutate(notif.id);
    }
    setOpen(false);
    if (notif.targetRoute) {
      navigate(notif.targetRoute);
    }
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        type="button"
        className={`notification-bell-btn${unreadCount > 0 ? ' has-unread' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notificaciones (${unreadCount} no leídas)`}
        title="Notificaciones y avisos"
      >
        <UiIcon name="bell" />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <div className="notification-header-title">
              <UiIcon name="bell" />
              <span>Notificaciones</span>
              {unreadCount > 0 && (
                <span className="notification-unread-pill">{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-mark-all-btn"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                Marcar leídas
              </button>
            )}
          </div>

          <div className="notification-dropdown-body">
            {isLoading ? (
              <div className="notification-empty">Cargando avisos...</div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <UiIcon name="fileCheck" />
                <p>No tienes notificaciones pendientes.</p>
              </div>
            ) : (
              notifications.slice(0, 15).map((n) => {
                const isDte = n.tipo?.includes('RECARGA') || n.tipo?.includes('DTE') || n.tipo?.includes('TRIBUTARI');
                return (
                  <div
                    key={n.id}
                    className={`notification-item${!n.leida ? ' unread' : ''}${isDte ? ' dte-alert' : ''}`}
                    onClick={() => handleSelectNotification(n)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="notification-item-icon">
                      <UiIcon name={isDte ? 'wallet' : 'alert'} />
                    </div>
                    <div className="notification-item-content">
                      <div className="notification-item-top">
                        <strong className="notification-item-title">{n.titulo}</strong>
                        <span className="notification-item-time">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="notification-item-message">{n.mensaje}</p>
                      {n.targetRoute && (
                        <span className="notification-item-link">
                          Ver detalle en Pedidos &rarr;
                        </span>
                      )}
                    </div>
                    {!n.leida && <span className="notification-item-dot" title="No leída" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}