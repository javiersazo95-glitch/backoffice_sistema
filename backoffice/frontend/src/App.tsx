import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import AreaSelectorPage from '@/pages/AreaSelectorPage';
import LoginPage from '@/pages/LoginPage';
import AdminFinancePage from '@/modules/administration/AdminFinancePage';
import PagoProveedoresPage from '@/modules/administration/PagoProveedoresPage';
import SupportPage from '@/modules/support/SupportPage';
import DashboardPage from '@/components/dashboard/DashboardPage';
import SellersPage from '@/components/sellers/SellersPage';
import ValidationsPage from '@/components/validations/ValidationsPage';
import MediationsPage from '@/components/mediations/MediacionesPage';
import AlertsPage from '@/components/alerts/AlertsPage';
import AuditPage from '@/components/audit/AuditPage';
import ReportsPage from '@/components/reports/ReportsPage';
import PermissionsConfigPage from '@/pages/PermissionsConfigPage';
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><AreaSelectorPage /></RequireAuth>} />
      <Route path="/configuracion" element={<RequireSuperAdmin><PermissionsConfigPage /></RequireSuperAdmin>} />
      <Route path="/administracion" element={<RequireArea area="ADMINISTRACION_CONTABLE"><AppShell /></RequireArea>}>
        <Route index element={<AdminFinancePage />} />
        <Route path="resumen" element={<AdminFinancePage />} />
        <Route path="pedidos" element={<AdminFinancePage />} />
        <Route path="liquidaciones" element={<AdminFinancePage />} />
        <Route path="gastos" element={<AdminFinancePage />} />
        <Route path="retiros" element={<AdminFinancePage />} />
        <Route path="pago-proveedores" element={<PagoProveedoresPage />} />
      </Route>
      <Route path="/soporte/*" element={<RequireArea area="SOPORTE"><AppShell noSidebar><SupportPage /></AppShell></RequireArea>} />
      <Route path="/confianza/*" element={
        <RequireArea area="MEDIACION_CONFIANZA">
          <AppShell>
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="sellers" element={<SellersPage />} />
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
