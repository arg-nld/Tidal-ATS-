import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/auth/AuthPage';
import { PortalHeader } from './components/common/PortalHeader';
import { NotificationDrawer } from './components/common/NotificationDrawer';
import { HrPortal } from './components/hr/HrPortal';
import { ApplicantPortal } from './components/applicant/ApplicantPortal';

function AtsApp() {
  const { isHr, isAuthenticated, authReady, user } = useAuth();
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

  // Wait for persisted-session validation before deciding which portal to render.
  if (!authReady) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Loading session...</div>;
  }

  // Show auth screen if not signed in
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Universal Top Header */}
      <PortalHeader onOpenNotifications={() => setIsNotifDrawerOpen(true)} />

      {/* Role-Based Portal View */}
      <div className="flex-1 overflow-hidden" key={user?.id}>
        {isHr ? (
          <HrPortal />
        ) : (
          <ApplicantPortal />
        )}
      </div>

      {/* Global Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotifDrawerOpen}
        onClose={() => setIsNotifDrawerOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AtsApp />
    </AuthProvider>
  );
}