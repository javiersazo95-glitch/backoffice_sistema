import { useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import HelpSupportWidget from '@/components/shared/HelpSupportWidget';
import NotificationBell from './NotificationBell';

export default function AppShell({ children, noSidebar }: { children?: ReactNode; noSidebar?: boolean }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (noSidebar) {
    return (
      <div className="app-shell" style={{ display: 'block' }}>
        <main className="content" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
          <header className="app-shell-topbar">
            <NotificationBell user={user} />
          </header>
          {children ?? <Outlet />}
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <button
          className="mobile-hamburger"
          type="button"
          aria-label="Abrir menú"
          onClick={() => setSidebarOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <img src="/assets/repuestop-logo-cropped.jpg" alt="RepuesTop" className="mobile-topbar-logo" />
        <div className="mobile-topbar-spacer" />
        <NotificationBell user={user} />
      </header>

      {/* Overlay backdrop */}
      {sidebarOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar user={user} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <main className="content">
        <header className="app-shell-topbar">
          <NotificationBell user={user} />
        </header>
        {children ?? <Outlet />}
      </main>
      <HelpSupportWidget />
    </div>
  );
}