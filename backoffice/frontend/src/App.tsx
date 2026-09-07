import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import * as capturersApi from '@/api/capturers';
import AreaSelectorPage from '@/pages/AreaSelectorPage';
import LoginPage from '@/pages/LoginPage';
import AdminFinancePage from '@/modules/administration/AdminFinancePage';
import PagoProveedoresPage from '@/modules/administration/PagoProveedoresPage';
import PagoCaptadoresPage from '@/modules/administration/PagoCaptadoresPage';
import BoletasVentaPage from '@/modules/administration/BoletasVentaPage';
import SupportPage from '@/modules/support/SupportPage';
import DashboardPage from '@/components/dashboard/DashboardPage';
import SellersPage from '@/components/sellers/SellersPage';
import CapturersPage from '@/components/capturers/CapturersPage';
import ValidationsPage from '@/components/validations/ValidationsPage';
import MediationsPage from '@/components/mediations/MediacionesPage';
import AlertsPage from '@/components/alerts/AlertsPage';
import AuditPage from '@/components/audit/AuditPage';
import ReportsPage from '@/components/reports/ReportsPage';
import PermissionsConfigPage from '@/pages/PermissionsConfigPage';
import CapturerRegisterPage from '@/pages/CapturerRegisterPage';
import CapturerPortalPage from '@/pages/CapturerPortalPage';
import CapturerStatusPage from '@/pages/CapturerStatusPage';
import CapturerAccountPage from '@/pages/CapturerAccountPage';
import CapturerChatsPage from '@/pages/CapturerChatsPage';
import CapturerHelpPage from '@/pages/CapturerHelpPage';
import CapturerSupportPage from '@/pages/CapturerSupportPage';
import ActivateEmployeePage from '@/pages/ActivateEmployeePage';
import RecoverPasswordPage from '@/pages/RecoverPasswordPage';
import { Role } from '@/types/auth';
import { hasBackofficePermission } from '@/hooks/usePermissions';
import type { BackofficeArea } from '@/types/auth';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RequireSuperAdmin({ children }: { children: JSX.Element }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== Role.SUPER_ADMIN) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RequireArea({ area, children }: { area: BackofficeArea; children: JSX.Element }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasBackofficePermission(user, area)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RequireCapturer({ children }: { children: JSX.Element }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login?type=capturer" replace />;
  if (user?.role !== Role.CAPTADOR) return <Navigate to="/" replace />;
  return children;
}

// Portal del captador: solo accesible cuando la postulación fue aprobada.
// Mientras esté pendiente o rechazada, se redirige a la vista de estado.
function RequireApprovedCapturer({ children }: { children: JSX.Element }) {
  const { user, isAuthenticated } = useAuth();
  const enabled = isAuthenticated && user?.role === Role.CAPTADOR;
  const statusQuery = useQuery({
    queryKey: ['capturer-status'],
    queryFn: capturersApi.getStatus,
    enabled,
  });

  if (!isAuthenticated) return <Navigate to="/login?type=capturer" replace />;
  if (user?.role !== Role.CAPTADOR) return <Navigate to="/" replace />;
  if (statusQuery.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
        Cargando tu cuenta…
      </div>
    );
  }
  if (statusQuery.data && statusQuery.data.estado !== 'APROBADO') {
    return <Navigate to="/captador/estado" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activar-empleado" element={<ActivateEmployeePage />} />
      <Route path="/recuperar-contrasena" element={<RecoverPasswordPage />} />
      <Route path="/registro-captador" element={<CapturerRegisterPage />} />
      <Route path="/captador/estado" element={<RequireCapturer><CapturerStatusPage /></RequireCapturer>} />
      <Route path="/captador" element={<RequireApprovedCapturer><CapturerPortalPage /></RequireApprovedCapturer>} />
      <Route path="/captador/comisiones" element={<RequireApprovedCapturer><CapturerPortalPage /></RequireApprovedCapturer>} />
      <Route path="/captador/ranking" element={<RequireApprovedCapturer><CapturerPortalPage /></RequireApprovedCapturer>} />
      <Route path="/captador/retiros" element={<RequireApprovedCapturer><CapturerPortalPage /></RequireApprovedCapturer>} />
      <Route path="/captador/cuenta" element={<RequireApprovedCapturer><CapturerAccountPage /></RequireApprovedCapturer>} />
      <Route path="/captador/chats" element={<RequireApprovedCapturer><CapturerChatsPage /></RequireApprovedCapturer>} />
      <Route path="/captador/ayuda" element={<RequireApprovedCapturer><CapturerHelpPage /></RequireApprovedCapturer>} />
      <Route path="/captador/soporte" element={<RequireApprovedCapturer><CapturerSupportPage /></RequireApprovedCapturer>} />
      <Route path="/" element={<RequireAuth><AreaSelectorPage /></RequireAuth>} />
      <Route path="/configuracion" element={<RequireSuperAdmin><PermissionsConfigPage /></RequireSuperAdmin>} />
      <Route path="/retiros" element={<RequireSuperAdmin><AppShell noSidebar><AdminFinancePage /></AppShell></RequireSuperAdmin>} />
      <Route path="/administracion" element={<RequireArea area="ADMINISTRACION_CONTABLE"><AppShell /></RequireArea>}>
        <Route index element={<AdminFinancePage />} />
        <Route path="resumen" element={<AdminFinancePage />} />
        <Route path="pedidos" element={<AdminFinancePage />} />
        <Route path="liquidaciones" element={<AdminFinancePage />} />
        <Route path="gastos" element={<AdminFinancePage />} />
        <Route path="pago-proveedores" element={<PagoProveedoresPage />} />
        <Route path="pago-captadores" element={<PagoCaptadoresPage />} />
        <Route path="boletas" element={<BoletasVentaPage />} />
      </Route>
      <Route path="/soporte/*" element={<RequireArea area="SOPORTE"><AppShell noSidebar><SupportPage /></AppShell></RequireArea>} />
      <Route path="/confianza/*" element={
        <RequireArea area="MEDIACION_CONFIANZA">
          <AppShell>
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="sellers" element={<SellersPage />} />
              <Route path="captadores" element={<CapturersPage />} />
              <Route path="validations" element={<ValidationsPage />} />
              <Route path="mediations" element={<MediationsPage />} />
              <Route path="alertas" element={<AlertsPage />} />
              <Route path="bitacora" element={<AuditPage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Routes>
          </AppShell>
        </RequireArea>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
