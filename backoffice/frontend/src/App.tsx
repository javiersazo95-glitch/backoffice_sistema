import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import AreaSelectorPage from '@/pages/AreaSelectorPage';
import LoginPage from '@/pages/LoginPage';
import AdminFinancePage from '@/modules/administration/AdminFinancePage';
import PagoProveedoresPage from '@/modules/administration/PagoProveedoresPage';
import PagoCaptadoresPage from '@/modules/administration/PagoCaptadoresPage';
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
import CapturerAccountPage from '@/pages/CapturerAccountPage';
import CapturerChatsPage from '@/pages/CapturerChatsPage';
import CapturerHelpPage from '@/pages/CapturerHelpPage';
import CapturerSupportPage from '@/pages/CapturerSupportPage';
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro-captador" element={<CapturerRegisterPage />} />
      <Route path="/captador" element={<RequireCapturer><CapturerPortalPage /></RequireCapturer>} />
      <Route path="/captador/comisiones" element={<RequireCapturer><CapturerPortalPage /></RequireCapturer>} />
      <Route path="/captador/ranking" element={<RequireCapturer><CapturerPortalPage /></RequireCapturer>} />
      <Route path="/captador/retiros" element={<RequireCapturer><CapturerPortalPage /></RequireCapturer>} />
      <Route path="/captador/cuenta" element={<RequireCapturer><CapturerAccountPage /></RequireCapturer>} />
      <Route path="/captador/chats" element={<RequireCapturer><CapturerChatsPage /></RequireCapturer>} />
      <Route path="/captador/ayuda" element={<RequireCapturer><CapturerHelpPage /></RequireCapturer>} />
      <Route path="/captador/soporte" element={<RequireCapturer><CapturerSupportPage /></RequireCapturer>} />
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
