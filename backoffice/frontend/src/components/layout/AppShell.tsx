import { useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import Toast from './Toast';
import HelpSupportWidget from '@/components/shared/HelpSupportWidget';

export default function AppShell({ children, noSidebar }: { children?: ReactNode; noSidebar?: boolean }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        {children ?? <Outlet />}
      </main>
      <HelpSupportWidget />
      <Toast />
    </div>
  );
}
