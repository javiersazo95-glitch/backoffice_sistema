import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import * as permissionsApi from '@/api/permissions';
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

function permissionText(permissions: BackofficePermission[]) {
  if (permissions.length === 0) return 'Sin permisos';
  return permissions.map((permission) => `${AREA_LABELS[permission.area]} · ${SLOT_LABELS[permission.slot]}`).join(', ');
}

export default function PermissionsConfigPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'permisos' | 'usuarios'>('permisos');
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState<permissionsApi.PermissionUser | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<BackofficePermission[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<BackofficeArea | 'All'>('All');
  const [slotFilter, setSlotFilter] = useState<BackofficePermissionSlot | 'All'>('All');
  const [page, setPage] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['permission-user-search', searchEmail],
    queryFn: () => permissionsApi.searchUsers(searchEmail),
    enabled: searchEmail.trim().length >= 2 && !selectedUser,
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

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedUser) throw new Error('Selecciona un usuario');
      return permissionsApi.updateUserPermissions(selectedUser.id, draftPermissions);
    },
    onSuccess: (updatedUser) => {
      setSelectedUser(updatedUser);
      setDraftPermissions(updatedUser.permissions ?? []);
      queryClient.invalidateQueries({ queryKey: ['permission-users'] });
      setShowSuccessModal(true);
    },
    onError: (error: any) => showToast(error.message || 'No se pudieron guardar los permisos'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ userId, permissionId }: { userId: number; permissionId: number }) =>
      permissionsApi.deleteUserPermission(userId, permissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-users'] });
      showToast('Permiso eliminado');
    },
    onError: (error: any) => showToast(error.message || 'No se pudo eliminar el permiso'),
  });

  const selectedSummary = useMemo(() => selectedUser ? permissionText(draftPermissions) : 'Selecciona un correo para editar permisos', [draftPermissions, selectedUser]);

  const selectUser = (user: permissionsApi.PermissionUser) => {
    setSelectedUser(user);
    setSearchEmail(user.email);
    setDraftPermissions(user.permissions ?? []);
  };

  const editUser = async (user: permissionsApi.PermissionUser) => {
    const fullUser = await permissionsApi.getUserPermissions(user.id);
    setActiveTab('permisos');
    selectUser(fullUser);
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
            <UiIcon name="users" />
            Usuarios
          </button>
        </nav>

        {activeTab === 'permisos' ? (
          <div className="permissions-workspace">
            <section className="permissions-config-header">
              <h2>Asignación por correo</h2>
              <p>Busca un usuario registrado y activa las ranuras permitidas para cada área.</p>
            </section>

            <div className="permission-search-panel">
              <label className="validation-search-field">
                <UiIcon name="search" />
                <input
                  type="search"
                  value={searchEmail}
                  onChange={(event) => {
                    setSearchEmail(event.target.value);
                    setSelectedUser(null);
                    setDraftPermissions([]);
                  }}
                  placeholder="Buscar correo registrado..."
                />
              </label>

              {!selectedUser && suggestions.length > 0 && (
                <div className="permission-suggestions">
                  {suggestions.map((user) => (
                    <button key={user.id} type="button" onClick={() => selectUser(user)}>
                      <span className="profile-badge">{user.initials}</span>
                      <span>
                        <strong>{user.email}</strong>
                        <small>{user.fullName}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="permission-selected-summary">
              <span className="seller-profile-section-icon blue"><UiIcon name="shield" /></span>
              <div>
                <strong>{selectedUser?.email ?? 'Sin usuario seleccionado'}</strong>
                <p>{selectedSummary}</p>
              </div>
            </div>

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
                            disabled={!selectedUser}
                            checked={hasPermission(draftPermissions, group.area, slot)}
                            onChange={() => setDraftPermissions((current) => togglePermission(current, group.area, slot))}
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

            <div className="permissions-config-actions">
              <button className="secondary-button" type="button" onClick={() => selectedUser && setDraftPermissions(selectedUser.permissions ?? [])} disabled={!selectedUser}>
                Revertir
              </button>
              <button className="primary-button" type="button" onClick={() => saveMutation.mutate()} disabled={!selectedUser || saveMutation.isPending}>
                Guardar permisos
              </button>
            </div>
          </div>
        ) : (
          <div className="permissions-workspace">
            <section className="permissions-config-header">
              <h2>Usuarios con permisos</h2>
              <p>Filtra, edita o elimina permisos registrados.</p>
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
                      <th>Permisos registrados</th>
                      <th style={{ width: 130 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingUsers ? (
                      <tr><td colSpan={4}>Cargando usuarios...</td></tr>
                    ) : !usersData || usersData.content.length === 0 ? (
                      <tr><td colSpan={4}>No hay usuarios para los filtros seleccionados.</td></tr>
                    ) : usersData.content.map((user) => (
                      <tr key={user.id}>
                        <td><strong>{user.email}</strong></td>
                        <td>{user.fullName}</td>
                        <td>
                          <div className="permission-chip-list">
                            {user.permissions.length === 0 ? (
                              <span className="muted">Sin permisos</span>
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
                            <button className="row-action" type="button" title="Editar" onClick={() => void editUser(user)}>
                              <UiIcon name="edit" />
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
        )}
      </div>
      {showSuccessModal && (
        <div className="case-modal-backdrop" onClick={() => setShowSuccessModal(false)}>
          <div className="case-modal" style={{ maxWidth: '400px', padding: '28px', textAlign: 'center', display: 'grid', justifyItems: 'center', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
            <div className="case-modal-icon green" style={{ width: '56px', height: '56px', borderRadius: '50%' }}>
              <UiIcon name="check" style={{ width: '28px', height: '28px' }} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold', color: '#172741' }}>¡Registro Exitoso!</h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#5b6b84' }}>El permiso ha sido registrado con éxito.</p>
            </div>
            <button className="primary-button" style={{ width: '100%', marginTop: '8px' }} onClick={() => setShowSuccessModal(false)}>
              Aceptar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
