import { LogOut, Settings, CreditCard, Building2, KeyRound, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/context/AuthContext';

// Self-navigating via the router — no onNavigate prop drilling. Rendered
// only inside RouterProvider (MainApp, ProfileRoute).
export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const goHome = () => navigate('/');
  const goToProfile = () => navigate('/profile');
  const goToBilling = () => navigate('/billing');
  const goToWorkspaces = () => navigate('/workspaces');
  const goToApiKeys = () => navigate('/api-keys');
  const goToAuditLogs = () => navigate('/admin/audit-logs');

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <button onClick={goHome} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <span className="font-bold text-black text-lg">Clean Architecture</span>
        </button>
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <button
            onClick={goToWorkspaces}
            className="flex items-center gap-1.5 text-gray-600 hover:text-black transition-colors text-sm cursor-pointer"
          >
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Workspaces</span>
          </button>
          <button
            onClick={goToApiKeys}
            className="flex items-center gap-1.5 text-gray-600 hover:text-black transition-colors text-sm cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span className="hidden sm:inline">API Keys</span>
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={goToAuditLogs}
              className="flex items-center gap-1.5 text-gray-600 hover:text-black transition-colors text-sm cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Audit Logs</span>
            </button>
          )}
          <button
            onClick={goToBilling}
            className="flex items-center gap-1.5 text-gray-600 hover:text-black transition-colors text-sm cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Billing</span>
          </button>
          <button
            onClick={goToProfile}
            className="flex items-center gap-1.5 text-gray-600 hover:text-black transition-colors text-sm cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-gray-600 hover:text-black transition-colors text-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}

