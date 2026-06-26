import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import AreaSelectorPage from '@/pages/AreaSelectorPage';
import LoginPage from '@/pages/LoginPage';
import AdminFinancePage from '@/modules/administration/AdminFinancePage';
import SupportPage from '@/modules/support/SupportPage';
import DashboardPage from '@/components/dashboard/DashboardPage';
import SellersPage from '@/components/sellers/SellersPage';
import ValidationsPage from '@/components/validations/ValidationsPage';
import MediationsPage from '@/components/mediations/MediacionesPage';
import AlertsPage from '@/components/alerts/AlertsPage';
import AuditPage from '@/components/audit/AuditPage';
import ReportsPage from '@/components/reports/ReportsPage';
import PermissionsConfigPage from '@/pages/PermissionsConfigPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<RequireAuth><AreaSelectorPage /></RequireAuth>} />
      <Route path="/configuracion" element={<RequireAuth><PermissionsConfigPage /></RequireAuth>} />
      <Route path="/administracion" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<AdminFinancePage />} />
        <Route path="resumen" element={<AdminFinancePage />} />
        <Route path="pedidos" element={<AdminFinancePage />} />
        <Route path="liquidaciones" element={<AdminFinancePage />} />
        <Route path="gastos" element={<AdminFinancePage />} />
        <Route path="retiros" element={<AdminFinancePage />} />
      </Route>
      <Route path="/soporte/*" element={<RequireAuth><AppShell noSidebar><SupportPage /></AppShell></RequireAuth>} />
      <Route path="/confianza/*" element={
        <RequireAuth>
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
        </RequireAuth>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
