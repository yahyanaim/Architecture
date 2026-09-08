import { LogOut, Settings, CreditCard } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';

type Page = 'main' | 'profile' | 'pricing' | 'billing';

interface HeaderProps {
  onNavigate?: (page: Page) => void;
}

export function Header({ onNavigate }: HeaderProps) {
  const { user, logout } = useAuth();

  const goHome = () => {
    onNavigate?.('main');
  };

  const goToProfile = () => {
    onNavigate?.('profile');
  };

  const goToBilling = () => {
    onNavigate?.('billing');
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <button onClick={goHome} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <span className="font-bold text-black text-lg">Clean Architecture</span>
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={goToProfile}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <span className="text-gray-600 text-sm">
              {user?.name}
              {user?.role === 'admin' && <span className="ml-1 text-xs px-1.5 py-0.5 bg-black text-white rounded">{user.role}</span>}
            </span>
          </button>
          <button
            onClick={goToProfile}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors text-sm cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={goToBilling}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors text-sm cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            Billing
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors text-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
