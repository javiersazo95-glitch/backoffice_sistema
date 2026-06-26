import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import Toast from './Toast';
import HelpSupportWidget from '@/components/shared/HelpSupportWidget';

export default function AppShell({ children, noSidebar }: { children?: ReactNode; noSidebar?: boolean }) {
  const { user, logout } = useAuth();

  if (noSidebar) {
    return (
      <div className="app-shell" style={{ display: 'block' }}>
        <main className="content" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
          {children ?? <Outlet />}
        </main>
        <Toast />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        onLogout={logout}
      />
      <main className="content">
        {children ?? <Outlet />}
      </main>
      <HelpSupportWidget />
      <Toast />
    </div>
  );
}
