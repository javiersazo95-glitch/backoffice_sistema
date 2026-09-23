import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import * as permissionsApi from '@/api/permissions';
import * as foundersApi from '@/api/founders';
import * as capturersApi from '@/api/capturers';
import type { BackofficeArea, BackofficePermission, BackofficePermissionSlot } from '@/types/auth';

const AREA_LABELS: Record<BackofficeArea, string> = {
  ADMINISTRACION_CONTABLE: 'Administración Contable',
  SOPORTE: 'Soporte',
  MEDIACION_CONFIANZA: 'Confianza y Mediación',
};

const SLOT_LABELS: Record<BackofficePermissionSlot, string> = {
  OPERADOR: 'Operador',
  QA: 'QA',
};

const PERMISSION_GROUPS: Array<{
  area: BackofficeArea;
  icon: string;
  tone: string;
  slots: BackofficePermissionSlot[];
}> = [
  { area: 'ADMINISTRACION_CONTABLE', icon: 'wallet', tone: 'green', slots: ['OPERADOR'] },
  { area: 'SOPORTE', icon: 'headset', tone: 'blue', slots: ['OPERADOR', 'QA'] },
  { area: 'MEDIACION_CONFIANZA', icon: 'scale', tone: 'violet', slots: ['OPERADOR'] },
];

function hasPermission(permissions: BackofficePermission[], area: BackofficeArea, slot: BackofficePermissionSlot) {
  return permissions.some((permission) => permission.area === area && permission.slot === slot);
}

function togglePermission(permissions: BackofficePermission[], area: BackofficeArea, slot: BackofficePermissionSlot) {
  const exists = hasPermission(permissions, area, slot);
  if (exists) {
    return permissions.filter((permission) => !(permission.area === area && permission.slot === slot));
  }
  const withoutConflicts = area === 'SOPORTE'
    ? permissions.filter((permission) => permission.area !== 'SOPORTE')
    : permissions;
  return [...withoutConflicts, { area, slot }];
}

type DeletionState = {
  email?: string | null;
  deleted?: boolean;
  eliminado?: boolean;
  deletedAt?: string | null;
  eliminadoEn?: string | null;
  estado?: string;
};

function isDeleted(record: DeletionState) {
  const status = record.estado?.trim().toUpperCase();
  const email = record.email?.trim().toLowerCase() ?? '';
  return record.deleted === true
    || record.eliminado === true
    || record.deletedAt != null
    || record.eliminadoEn != null
    || status === 'ELIMINADO'
    || status === 'DELETED'
    || /^deleted-user-\d+@deleted\.repuestop\.local$/.test(email);
}

function invitationStatus(user: permissionsApi.PermissionUser) {
  const status = user.invitationStatus ?? (!user.active ? 'RECHAZADO' : !user.emailVerified ? 'PENDIENTE' : 'ACEPTADO');
  return { value: status, label: status === 'PENDIENTE' ? 'Pendiente' : status === 'RECHAZADO' ? 'Rechazado' : 'Aceptado' };
}

export default function PermissionsConfigPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'permisos' | 'usuarios' | 'captadores' | 'fundador'>('permisos');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermissions, setInvitePermissions] = useState<BackofficePermission[]>([]);
  const [inviteFeedback, setInviteFeedback] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [usersSearch, setUsersSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<BackofficeArea | 'All'>('All');
  const [slotFilter, setSlotFilter] = useState<BackofficePermissionSlot | 'All'>('All');
  const [page, setPage] = useState(0);
  const [founderSearch, setFounderSearch] = useState('');
  const [founderFilter, setFounderFilter] = useState<'ALL' | 'FOUNDER' | 'NON_FOUNDER'>('ALL');
  const [founderPage, setFounderPage] = useState(0);
  const [capturerSearch, setCapturerSearch] = useState('');

  const { data: founderConfig } = useQuery({
    queryKey: ['founder-config'],
    queryFn: foundersApi.getFounderConfig,
    enabled: activeTab === 'fundador',
  });

  const { data: founderData, isLoading: founderLoading } = useQuery({
    queryKey: ['founder-sellers', founderSearch, founderFilter, founderPage],
    queryFn: () => foundersApi.listFounders({ search: founderSearch || undefined, status: founderFilter, page: founderPage, size: 10 }),
    enabled: activeTab === 'fundador',
  });

  const founderConfigMutation = useMutation({
    mutationFn: foundersApi.updateFounderConfig,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['founder-config'] }); showToast('Ranura general actualizada'); },
    onError: (error: any) => showToast(error.message || 'No se pudo actualizar la ranura general'),
  });

  const founderMutation = useMutation({
    mutationFn: ({ sellerId, founder }: { sellerId: number; founder: boolean }) => foundersApi.setFounder(sellerId, founder),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['founder-sellers'] }); showToast('Condición Fundador actualizada'); },
    onError: (error: any) => showToast(error.message || 'No se pudo actualizar al vendedor'),
  });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['permission-users', usersSearch, areaFilter, slotFilter, page],
    queryFn: () => permissionsApi.listPermissionUsers({
      search: usersSearch || undefined,
      area: areaFilter,
      slot: slotFilter,
      page,
      size: 10,
    }),
    enabled: activeTab === 'usuarios',
  });

  const { data: capturers = [], isLoading: isLoadingCapturers } = useQuery({
    queryKey: ['managed-capturers'],
    queryFn: capturersApi.listManagedCapturers,
    enabled: activeTab === 'captadores' || activeTab === 'permisos',
    staleTime: 30_000,
  });

  const normalizedInviteEmail = inviteEmail.trim().toLowerCase();
  const isValidEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInviteEmail);

  const isCapturerEmailLocal = useMemo(() => {
    if (!isValidEmailFormat) return false;
    return capturers.some(
      (c) => c.email?.trim().toLowerCase() === normalizedInviteEmail && !isDeleted(c as unknown as Record<string, unknown>)
    );
  }, [normalizedInviteEmail, isValidEmailFormat, capturers]);

  const { data: emailValidation } = useQuery({
    queryKey: ['validate-employee-email', normalizedInviteEmail],
    queryFn: () => permissionsApi.validateEmployeeEmail(normalizedInviteEmail),
    enabled: isValidEmailFormat && activeTab === 'permisos',
    staleTime: 10_000,
  });

  const isCapturerEmail = isCapturerEmailLocal || Boolean(emailValidation?.isCaptador);
  const emailValidationError = isCapturerEmail
    ? 'Este correo ya pertenece a un captador en RepuesTop. No está permitido ser empleado y captador a la vez.'
    : emailValidation?.valid === false && emailValidation?.message
    ? emailValidation.message
    : null;

  const permissionUsers = useMemo(
    () => usersData?.content.filter((user) => !isDeleted(user)) ?? [],
    [usersData],
  );

  const founderSellers = useMemo(
    () => founderData?.content.filter((seller) => !isDeleted({ email: seller.email })) ?? [],
    [founderData],
  );

  const deactivateCapturerMutation = useMutation({
    mutationFn: capturersApi.deactivateCapturer,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['managed-capturers'] }); showToast('Cuenta de captador desactivada'); },
    onError: (error: any) => showToast(error.response?.data?.message || 'No se pudo desactivar la cuenta'),
  });
  const reactivateCapturerMutation = useMutation({
    mutationFn: capturersApi.reactivateCapturer,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['managed-capturers'] }); showToast('Cuenta de captador reactivada'); },
    onError: (error: any) => showToast(error.response?.data?.message || 'No se pudo reactivar la cuenta'),
  });

  const deleteCapturerMutation = useMutation({
    mutationFn: (userId: number) => permissionsApi.deleteUserAccount(userId, 'CAPTADOR'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['managed-capturers'] }); showToast('Cuenta de captador eliminada'); },
    onError: (error: any) => showToast(error.response?.data?.message || 'No se pudo eliminar la cuenta'),
  });

  const filteredCapturers = useMemo(() => {
    const term = capturerSearch.trim().toLocaleLowerCase('es-CL');
    return capturers.filter((capturer) => !isDeleted(capturer as unknown as Record<string, unknown>))
      .filter((capturer) => !term || [capturer.nombre, capturer.alias, capturer.email, capturer.rut, capturer.region, capturer.comuna]
      .some((value) => value.toLocaleLowerCase('es-CL').includes(term)));
  }, [capturers, capturerSearch]);

  const inviteMutation = useMutation({
    mutationFn: () => permissionsApi.inviteEmployee({ fullName: inviteName, email: inviteEmail, permissions: invitePermissions }),
    onSuccess: (invited) => {
      const emailWasSent = invited.invitationEmailSent !== false;
      const text = emailWasSent
        ? `Invitación enviada a ${invited.email} y permisos registrados.`
        : `La cuenta de ${invited.email} quedó registrada, pero el correo no fue enviado. Revisa RESEND_API_KEY en dev.`;
      setInviteFeedback({ tone: emailWasSent ? 'success' : 'warning', text });
      setInviteName(''); setInviteEmail(''); setInvitePermissions([]);
      setPage(0);
      queryClient.invalidateQueries({ queryKey: ['permission-users'] });
      showToast(text);
      setActiveTab('usuarios');
    },
    onError: (error: any) => {
      const text = error.response?.data?.message || error.message || 'No se pudo invitar al empleado';
      setInviteFeedback({ tone: 'error', text });
      showToast(text);
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: permissionsApi.resendEmployeeInvitation,
    onSuccess: (invited) => {
      const emailWasSent = invited.invitationEmailSent !== false;
      const text = emailWasSent
        ? `Invitación reenviada a ${invited.email}.`
        : `La invitación de ${invited.email} sigue pendiente, pero el correo no fue enviado. Revisa RESEND_API_KEY en dev.`;
      setInviteFeedback({ tone: emailWasSent ? 'success' : 'warning', text });
      queryClient.invalidateQueries({ queryKey: ['permission-users'] });
      showToast(text);
    },
    onError: (error: any) => {
      const text = error.response?.data?.message || error.message || 'No se pudo reenviar la invitación';
      setInviteFeedback({ tone: 'error', text });
      showToast(text);
    },
  });

  const [editingEmployee, setEditingEmployee] = useState<permissionsApi.PermissionUser | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<BackofficePermission[]>([]);

  const updatePermissionsMutation = useMutation({
    mutationFn: ({ userId, permissions }: { userId: number; permissions: BackofficePermission[] }) =>
      permissionsApi.updateUserPermissions(userId, permissions),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['permission-users'] });
      showToast(`Permisos actualizados para ${updatedUser.fullName || updatedUser.email}`);
      setEditingEmployee(null);
    },
    onError: (error: any) => {
      const text = error.response?.data?.message || error.message || 'No se pudieron actualizar los permisos';
      showToast(text);
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: (userId: number) => permissionsApi.deleteEmployee(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-users'] });
      showToast('Empleado eliminado del sistema');
    },
    onError: (error: any) => {
      const text = error.response?.data?.message || error.message || 'No se pudo eliminar al empleado';
      showToast(text);
    },
  });

  const handleOpenEdit = (user: permissionsApi.PermissionUser) => {
    setEditingEmployee(user);
    setEditingPermissions(user.permissions.map((p) => ({ area: p.area, slot: p.slot })));
  };

  const handleToggleEditingPermission = (area: BackofficeArea, slot: BackofficePermissionSlot) => {
    setEditingPermissions((current) => togglePermission(current, area, slot));
  };

  const handleDeleteEmployee = (user: permissionsApi.PermissionUser) => {
    if (user.role?.toUpperCase() === 'SUPER_ADMIN') {
      showToast('No es posible eliminar a un Super Administrador.');
      return;
    }
    const confirmed = window.confirm(
      `¿Estás seguro de eliminar a ${user.fullName} (${user.email})?\n\n` +
      `Esta acción eliminará todos sus accesos al Backoffice y liberará el correo para futuras recontrataciones o nuevos registros en RepuesTop.`
    );
    if (!confirmed) return;
    deleteEmployeeMutation.mutate(user.id);
  };

  const deleteMutation = useMutation({
    mutationFn: ({ userId, permissionId }: { userId: number; permissionId: number }) =>
      permissionsApi.deleteUserPermission(userId, permissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-users'] });
      showToast('Permiso eliminado');
    },
    onError: (error: any) => showToast(error.message || 'No se pudo eliminar el permiso'),
  });

  const isInviting = Boolean(inviteName.trim() || inviteEmail.trim());
  const activePermissions = invitePermissions;
  const inviteInitials = inviteName.trim()
    ? inviteName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
    : '?';
  const toggleActivePermission = (area: BackofficeArea, slot: BackofficePermissionSlot) => {
    setInvitePermissions((current) => togglePermission(current, area, slot));
  };

  return (
    <section className="permissions-config-shell">
      <header className="permissions-config-topbar">
        <button className="ghost-button" onClick={() => navigate('/')}>
          <UiIcon name="arrowRight" className="rotate-180" />
          Volver
        </button>
        <h1>Gestión de Permisos</h1>
        <div />
      </header>

      <div className="permissions-config-content">
        <nav className="module-tabs" aria-label="Gestión de permisos">
          <button className={activeTab === 'permisos' ? 'active' : ''} type="button" onClick={() => setActiveTab('permisos')}>
            <UiIcon name="shield" />
            Permisos
          </button>
          <button className={activeTab === 'usuarios' ? 'active' : ''} type="button" onClick={() => setActiveTab('usuarios')}>
            <UiIcon name="building" />
            Empleados
          </button>
          <button className={activeTab === 'captadores' ? 'active' : ''} type="button" onClick={() => setActiveTab('captadores')}>
            <UiIcon name="users" />
            Captadores
          </button>
          <button className={activeTab === 'fundador' ? 'active' : ''} type="button" onClick={() => setActiveTab('fundador')}>
            <UiIcon name="crown" className="founder-crown-icon" />
            Fundador
          </button>
        </nav>

        {inviteFeedback && (
          <div className={`employee-invite-feedback ${inviteFeedback.tone}`} role={inviteFeedback.tone === 'error' ? 'alert' : 'status'}>
            <UiIcon name={inviteFeedback.tone === 'success' ? 'check' : 'alert'} />
            <span>{inviteFeedback.text}</span>
            <button type="button" onClick={() => setInviteFeedback(null)} aria-label="Cerrar aviso"><UiIcon name="close" /></button>
          </div>
        )}

        {activeTab === 'permisos' ? (
          <div className="permissions-workspace">
            <section className="permissions-hero">
              <div className="permissions-hero-content">
                <div className="permissions-hero-eyebrow-row">
                  <span className="permissions-eyebrow">
                    <span className="permissions-status-dot" />
                    <UiIcon name="shieldCheck" />
                    Control de Acceso
                  </span>
                </div>
                <h2>Permisos del equipo</h2>
                <p>Administra las credenciales del personal, define permisos por área y ranura, y controla el acceso seguro al Backoffice.</p>
                <div className="permissions-hero-tags">
                  <span className="permissions-hero-tag"><UiIcon name="lock" /> Control granular</span>
                  <span className="permissions-hero-tag"><UiIcon name="building" /> 3 Áreas operativas</span>
                  <span className="permissions-hero-tag"><UiIcon name="shield" /> Acceso protegido</span>
                </div>
              </div>
              <div className="permissions-hero-note">
                <div className="permissions-hero-note-icon">
                  <UiIcon name="lock" />
                </div>
                <div className="permissions-hero-note-text">
                  <span className="hero-note-badge"><span className="hero-pulse-dot" /> Entorno seguro</span>
                  <strong>Acceso por Ranura</strong>
                  <small>Solo usuarios autorizados</small>
                </div>
              </div>
            </section>

            <div className="permission-entry-grid">
              <section className="permission-entry-card invite-card">
                <div className="permission-entry-heading"><span className="permission-entry-icon"><UiIcon name="users" /></span><div><h3>Invitar empleado</h3><p>Crea una cuenta y envía un enlace de activación.</p></div></div>
                <div className="invite-fields">
                  <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nombre completo" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="correo@empresa.cl"
                    style={emailValidationError ? { borderColor: '#e04f44', backgroundColor: '#fff8f8' } : undefined}
                  />
                </div>
                {emailValidationError && (
                  <div className="employee-invite-feedback error" style={{ margin: '6px 0 0', padding: '9px 12px', fontSize: '12.5px' }} role="alert">
                    <UiIcon name="alert" />
                    <span>{emailValidationError}</span>
                  </div>
                )}
                <small>{invitePermissions.length ? `${invitePermissions.length} permiso${invitePermissions.length === 1 ? '' : 's'} seleccionado${invitePermissions.length === 1 ? '' : 's'} para la invitación.` : 'Selecciona al menos un permiso más abajo para habilitar el envío.'}</small>
                <button
                  className="primary-button invite-submit"
                  type="button"
                  disabled={!inviteName.trim() || !inviteEmail.trim() || !invitePermissions.length || inviteMutation.isPending || Boolean(emailValidationError)}
                  onClick={() => {
                    if (emailValidationError) {
                      showToast(emailValidationError);
                      return;
                    }
                    inviteMutation.mutate();
                  }}
                >
                  {inviteMutation.isPending ? 'Enviando…' : 'Enviar invitación'}
                </button>
              </section>

              <div className={`permission-selected-summary ${isInviting ? 'has-user' : ''}`}>
                <span className="permission-user-avatar">{inviteInitials}</span>
                <div>
                  <span className="summary-label">Empleado seleccionado</span>
                  <strong>{inviteName.trim() || 'Nuevo empleado'}</strong>
                  <p>{inviteEmail.trim() || 'Ingresa el correo del nuevo empleado.'}</p>
                </div>
                <span className="summary-permission-count">{activePermissions.length} {activePermissions.length === 1 ? 'permiso' : 'permisos'}</span>
              </div>
            </div>

            <div className="permission-section-title"><div><h3>Áreas habilitadas</h3><p>Estos permisos se asignarán al empleado invitado.</p></div><span>{activePermissions.length}/4 seleccionados</span></div>
            <div className="permissions-config-grid">
              {PERMISSION_GROUPS.map((group) => (
                <article key={group.area} className="permissions-config-card">
                  <div className="permissions-config-card-header">
                    <span className={`seller-profile-section-icon ${group.tone}`}><UiIcon name={group.icon} /></span>
                    <div>
                      <h3>{AREA_LABELS[group.area]}</h3>
                      <p>Ranuras disponibles para esta área.</p>
                    </div>
                  </div>

                  <div className="permissions-config-card-roles">
                    {group.slots.map((slot) => (
                      <div className="role-toggle" key={slot}>
                        <label className="role-toggle-label">
                          <input
                            type="checkbox"
                            disabled={!isInviting}
                            checked={hasPermission(activePermissions, group.area, slot)}
                            onChange={() => toggleActivePermission(group.area, slot)}
                          />
                          <span className="role-toggle-switch" />
                          <span className="role-toggle-text">
                            <UiIcon name={slot === 'QA' ? 'alert' : 'users'} />
                            {SLOT_LABELS[slot]}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

          </div>
        ) : activeTab === 'usuarios' ? (
          <div className="permissions-workspace">
            <section className="permissions-config-header">
              <h2>Empleados con permisos</h2>
              <p>Consulta los permisos asignados al personal y revoca accesos cuando corresponda.</p>
            </section>

            <div className="validation-filters permissions-user-filters">
              <label className="validation-search-field">
                <UiIcon name="search" />
                <input type="search" value={usersSearch} onChange={(event) => { setUsersSearch(event.target.value); setPage(0); }} placeholder="Correo o nombre..." />
              </label>
              <label className="validation-filter-field">
                <span>Área</span>
                <select value={areaFilter} onChange={(event) => { setAreaFilter(event.target.value as BackofficeArea | 'All'); setPage(0); }}>
                  <option value="All">Todas</option>
                  {Object.entries(AREA_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="validation-filter-field">
                <span>Ranura</span>
                <select value={slotFilter} onChange={(event) => { setSlotFilter(event.target.value as BackofficePermissionSlot | 'All'); setPage(0); }}>
                  <option value="All">Todas</option>
                  {Object.entries(SLOT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            <div className="panel">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Correo</th>
                      <th>Usuario</th>
                      <th>Estado</th>
                      <th>Permisos registrados</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingUsers ? (
                      <tr><td colSpan={5}>Cargando usuarios...</td></tr>
                    ) : permissionUsers.length === 0 ? (
                      <tr><td colSpan={5}>No hay usuarios para los filtros seleccionados.</td></tr>
                    ) : permissionUsers.map((user) => (
                      <tr key={user.id}>
                        <td><strong>{user.email}</strong></td>
                        <td>{user.fullName}</td>
                        <td>
                          <div className="employee-invitation-cell">
                            <span className={`employee-invitation-status ${invitationStatus(user).value.toLowerCase()}`}>{invitationStatus(user).label}</span>
                            {invitationStatus(user).value === 'PENDIENTE' && (
                              <button
                                className="employee-resend-button"
                                type="button"
                                disabled={resendInvitationMutation.isPending}
                                onClick={() => resendInvitationMutation.mutate(user.id)}
                              >
                                <UiIcon name="mail" /> Reenviar
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="permission-chip-list">
                            {user.permissions.length === 0 ? (
                              <div className="employee-no-permissions-container">
                                <span className="employee-no-permissions-badge">
                                  <UiIcon name="lock" /> Sin permisos activos
                                </span>
                                <button
                                  type="button"
                                  className="employee-assign-shortcut-btn"
                                  onClick={() => handleOpenEdit(user)}
                                  title="Asignar permisos a este empleado"
                                >
                                  <UiIcon name="plus" /> Asignar
                                </button>
                              </div>
                            ) : user.permissions.map((permission) => (
                              <span className={`permission-removable-chip ${permission.slot === 'QA' ? 'danger' : ''}`} key={permission.id ?? `${permission.area}-${permission.slot}`}>
                                {AREA_LABELS[permission.area]} · {SLOT_LABELS[permission.slot]}
                                {typeof permission.id === 'number' && (
                                  <button type="button" onClick={() => deleteMutation.mutate({ userId: user.id, permissionId: permission.id! })} aria-label="Eliminar permiso">
                                    <UiIcon name="close" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="seller-actions">
                            <button
                              className="row-action"
                              type="button"
                              title="Editar permisos"
                              onClick={() => handleOpenEdit(user)}
                            >
                              <UiIcon name="edit" />
                            </button>
                            <button
                              className="row-action danger"
                              type="button"
                              title={user.role?.toUpperCase() === 'SUPER_ADMIN' ? 'No se puede eliminar a un Super Administrador' : 'Eliminar empleado'}
                              disabled={deleteEmployeeMutation.isPending || user.role?.toUpperCase() === 'SUPER_ADMIN'}
                              onClick={() => handleDeleteEmployee(user)}
                            >
                              <UiIcon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {usersData && usersData.totalPages > 1 && (
              <div className="table-pagination">
                <span>Página {page + 1} de {usersData.totalPages}</span>
                <div>
                  <button className="page-button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} type="button">Anterior</button>
                  <button className="page-button" disabled={page === usersData.totalPages - 1} onClick={() => setPage((current) => current + 1)} type="button">Siguiente</button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'captadores' ? (
          <div className="permissions-workspace">
            <section className="permissions-config-header">
              <h2>Gestión de captadores</h2>
              <p>Administra las cuentas de captadores. Desactivar bloquea el acceso; eliminar aplica la baja definitiva de la cuenta y preserva la auditoría contable.</p>
            </section>

            <div className="validation-filters permissions-user-filters">
              <label className="validation-search-field">
                <UiIcon name="search" />
                <input type="search" value={capturerSearch} onChange={(event) => setCapturerSearch(event.target.value)} placeholder="Nombre, alias, correo, RUT o ubicación..." />
              </label>
            </div>

            <div className="panel"><div className="table-wrap"><table><thead><tr>
              <th>Captador</th><th>Contacto</th><th>Ubicación</th><th>Estado</th><th>Acciones</th>
            </tr></thead><tbody>
              {isLoadingCapturers ? <tr><td colSpan={5}>Cargando captadores...</td></tr>
                : filteredCapturers.length === 0 ? <tr><td colSpan={5}>No hay captadores para los filtros seleccionados.</td></tr>
                : filteredCapturers.map((capturer) => <tr key={capturer.id}>
                  <td><strong>{capturer.nombre}</strong><br /><span className="muted">@{capturer.alias} · {capturer.rut}</span></td>
                  <td>{capturer.email}<br /><span className="muted">{capturer.telefono}</span></td>
                  <td>{capturer.comuna}, {capturer.region}</td>
                  <td><span className={`status-badge ${capturer.activo ? 'approved' : 'rejected'}`}>{capturer.activo ? capturer.estado : 'DESACTIVADO'}</span></td>
                  <td><div className="seller-actions">
                    <label className="role-toggle-label" title={capturer.activo ? 'Desactivar acceso' : 'Reactivar acceso'}>
                      <input type="checkbox" checked={capturer.activo} disabled={deactivateCapturerMutation.isPending || reactivateCapturerMutation.isPending}
                        onChange={(event) => { const activating = event.target.checked; const question = activating ? `¿Reactivar el acceso de @${capturer.alias}?` : `¿Desactivar el acceso de @${capturer.alias}? Mantendrá su historial y no podrá iniciar sesión.`; if (!window.confirm(question)) return; if (activating) reactivateCapturerMutation.mutate(capturer.id); else deactivateCapturerMutation.mutate(capturer.id); }} />
                      <span className="role-toggle-switch" />
                    </label>
                    <button className="row-action danger" type="button" title="Eliminar cuenta" disabled={deleteCapturerMutation.isPending}
                      onClick={() => { if (window.confirm(`¿Eliminar la cuenta de @${capturer.alias}? Esta acción desactiva sus credenciales y no se puede deshacer.`)) deleteCapturerMutation.mutate(capturer.usuarioId); }}>
                      <UiIcon name="trash" />
                    </button>
                  </div></td>
                </tr>)}
            </tbody></table></div></div>
          </div>
        ) : (
          <div className="permissions-workspace">
            <section className="permissions-config-header">
              <h2>Vendedores Fundadores</h2>
              <p>Administra el beneficio comercial para nuevos registros o vendedores específicos.</p>
            </section>

            <article className="founder-general-card">
              <div>
                <span className="founder-badge"><UiIcon name="crown" />Fundador</span>
                <h3>Ranura general</h3>
                <p>Mientras esté activa, cada tienda que se apruebe recibe la condición Fundador (5% + IVA) durante sus primeros {founderConfig?.durationMonths ?? 3} meses, hasta completar las primeras {founderConfig?.storeQuota ?? 100} tiendas aprobadas.</p>
                {founderConfig?.approvedStores != null && (
                  <p className="muted">Cupo: {Math.min(founderConfig.approvedStores, founderConfig.storeQuota ?? 100)} de {founderConfig.storeQuota ?? 100} tiendas aprobadas.</p>
                )}
              </div>
              <label className="role-toggle-label">
                <input type="checkbox" checked={founderConfig?.founderForNewSellers ?? false}
                  disabled={!founderConfig || founderConfigMutation.isPending}
                  onChange={(event) => founderConfigMutation.mutate(event.target.checked)} />
                <span className="role-toggle-switch" />
              </label>
            </article>

            <div className="validation-filters permissions-user-filters">
              <label className="validation-search-field"><UiIcon name="search" />
                <input type="search" value={founderSearch} onChange={(event) => { setFounderSearch(event.target.value); setFounderPage(0); }} placeholder="Usuario, tienda o correo..." />
              </label>
              <label className="validation-filter-field"><span>Condición</span>
                <select value={founderFilter} onChange={(event) => { setFounderFilter(event.target.value as typeof founderFilter); setFounderPage(0); }}>
                  <option value="ALL">Todos</option><option value="FOUNDER">Fundadores</option><option value="NON_FOUNDER">No fundadores</option>
                </select>
              </label>
            </div>

            <div className="panel"><div className="table-wrap"><table><thead><tr>
              <th>Vendedor</th><th>Correo</th><th>Registro</th><th>Antigüedad</th><th>Beneficio hasta</th><th>Fundador</th>
            </tr></thead><tbody>
              {founderLoading ? <tr><td colSpan={6}>Cargando vendedores...</td></tr>
                : !founderSellers.length ? <tr><td colSpan={6}>No hay vendedores para los filtros seleccionados.</td></tr>
                : founderSellers.map((seller) => <tr key={seller.sellerId}>
                  <td><strong>{seller.storeName}</strong><br /><span className="muted">{seller.userName}</span></td>
                  <td>{seller.email}</td><td>{new Date(seller.registeredAt).toLocaleDateString('es-CL')}</td>
                  <td>{seller.founder ? `${seller.founderDays} días` : '—'}</td>
                  <td>{seller.founder && seller.founderUntil ? new Date(seller.founderUntil).toLocaleDateString('es-CL') : '—'}</td>
                  <td><label className="role-toggle-label"><input type="checkbox" checked={seller.founder}
                    disabled={founderMutation.isPending}
                    onChange={(event) => founderMutation.mutate({ sellerId: seller.sellerId, founder: event.target.checked })} />
                    <span className="role-toggle-switch" /></label></td>
                </tr>)}
            </tbody></table></div></div>
            {founderData && founderData.totalPages > 1 ? <div className="table-pagination"><span>Página {founderPage + 1} de {founderData.totalPages}</span><div>
              <button className="page-button" disabled={founderPage === 0} onClick={() => setFounderPage((value) => value - 1)}>Anterior</button>
              <button className="page-button" disabled={founderPage >= founderData.totalPages - 1} onClick={() => setFounderPage((value) => value + 1)}>Siguiente</button>
            </div></div> : null}
          </div>
        )}

        {editingEmployee && (
          <div className="case-modal-backdrop" onClick={() => setEditingEmployee(null)}>
            <div className="case-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
              <div className="case-modal-header">
                <span className="case-modal-icon" style={{ background: '#eaf3ff', color: '#0b5ed8' }}>
                  <UiIcon name="shieldCheck" />
                </span>
                <div className="case-modal-title">
                  <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#172b4d' }}>Editar permisos de empleado</h2>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#626f86' }}>
                    {editingEmployee.fullName} · {editingEmployee.email}
                  </p>
                </div>
                <button
                  className="ghost-button icon-only"
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  aria-label="Cerrar modal"
                >
                  <UiIcon name="close" />
                </button>
              </div>

              <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
                  <p style={{ margin: 0 }}>
                    Configura las áreas y ranuras que tendrá habilitadas <strong>{editingEmployee.fullName}</strong>. Los cambios se aplicarán de inmediato y el empleado los verá la próxima vez que inicie sesión o actualice la página.
                  </p>
                  {editingPermissions.length === 0 && (
                    <p style={{ margin: '8px 0 0', color: '#b42318', fontWeight: 600 }}>
                      ⚠️ Sin permisos asignados: El empleado no podrá ingresar a las áreas del Backoffice.
                    </p>
                  )}
                </div>

                <div className="permission-section-title" style={{ marginTop: '4px' }}>
                  <div>
                    <h3 style={{ fontSize: '14px' }}>Áreas operativas</h3>
                    <p>Activa o desactiva las ranuras correspondientes.</p>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0b5ed8' }}>
                    {editingPermissions.length} {editingPermissions.length === 1 ? 'permiso seleccionado' : 'permisos seleccionados'}
                  </span>
                </div>

                <div className="permissions-config-grid" style={{ gridTemplateColumns: '1fr', gap: '12px' }}>
                  {PERMISSION_GROUPS.map((group) => (
                    <article key={group.area} className="permissions-config-card" style={{ padding: '14px 16px' }}>
                      <div className="permissions-config-card-header">
                        <span className={`seller-profile-section-icon ${group.tone}`}>
                          <UiIcon name={group.icon} />
                        </span>
                        <div>
                          <h3 style={{ fontSize: '14px' }}>{AREA_LABELS[group.area]}</h3>
                          <p style={{ fontSize: '12px' }}>Ranuras disponibles para esta área.</p>
                        </div>
                      </div>

                      <div className="permissions-config-card-roles">
                        {group.slots.map((slot) => {
                          const checked = hasPermission(editingPermissions, group.area, slot);
                          return (
                            <div className="role-toggle" key={slot}>
                              <label className="role-toggle-label">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleEditingPermission(group.area, slot)}
                                />
                                <span className="role-toggle-switch" />
                                <span className="role-toggle-text">
                                  <UiIcon name={slot === 'QA' ? 'alert' : 'users'} />
                                  {SLOT_LABELS[slot]}
                                </span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setEditingEmployee(null)}
                    disabled={updatePermissionsMutation.isPending}
                  >
                    Cancelar
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={updatePermissionsMutation.isPending}
                    onClick={() => updatePermissionsMutation.mutate({
                      userId: editingEmployee.id,
                      permissions: editingPermissions,
                    })}
                  >
                    {updatePermissionsMutation.isPending ? 'Guardando…' : 'Guardar permisos'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
