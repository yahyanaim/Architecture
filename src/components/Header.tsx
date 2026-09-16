import { useState, useEffect } from 'react';
import {
  House,
  BookOpen,
  Building2,
  KeyRound,
  CreditCard,
  Settings,
  ShieldCheck,
  LogOut,
  Search,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/context/AuthContext';

// Self-navigating via the router.
// Floating desktop glass pill + mobile bottom tab pill styled in the project's
// clean monochrome / SaaS charte graphique (black, dark neutrals, clean borders).
export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hide on scroll down / show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 15) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const goHome = () => navigate('/');
  const goToDocs = () => navigate('/docs');
  const goToWorkspaces = () => navigate('/workspaces');
  const goToApiKeys = () => navigate('/api-keys');
  const goToAuditLogs = () => navigate('/admin/audit-logs');
  const goToBilling = () => navigate('/billing');
  const goToProfile = () => navigate('/profile');

  // Desktop navigation items
  const navLinks = [
    { label: 'Documentation', path: '/docs', icon: BookOpen, onClick: goToDocs },
    { label: 'Workspaces', path: '/workspaces', icon: Building2, onClick: goToWorkspaces },
    { label: 'API Keys', path: '/api-keys', icon: KeyRound, onClick: goToApiKeys },
    ...(user?.role === 'admin'
      ? [{ label: 'Audit Logs', path: '/admin/audit-logs', icon: ShieldCheck, onClick: goToAuditLogs }]
      : []),
    { label: 'Billing', path: '/billing', icon: CreditCard, onClick: goToBilling },
    { label: 'Settings', path: '/profile', icon: Settings, onClick: goToProfile },
  ];

  // Mobile bottom pill items (5-6 items to avoid overflow)
  const isMoreActive = location.pathname === '/profile' || location.pathname === '/admin/audit-logs';
  const mobileItems = [
    { label: 'Home', path: '/', icon: House, onClick: goHome },
    { label: 'Docs', path: '/docs', icon: BookOpen, onClick: goToDocs },
    { label: 'Workspaces', path: '/workspaces', icon: Building2, onClick: goToWorkspaces },
    { label: 'API Keys', path: '/api-keys', icon: KeyRound, onClick: goToApiKeys },
    { label: 'Billing', path: '/billing', icon: CreditCard, onClick: goToBilling },
    {
      label: 'More',
      path: null,
      icon: MoreHorizontal,
      onClick: () => setMobileMenuOpen((prev) => !prev),
    },
  ];

  return (
    <>
      {/* ========================================================================= */}
      {/* DESKTOP FLOATING NAVBAR (PROJECT CHARTE GRAPHIQUE)                         */}
      {/* ========================================================================= */}
      <header
        className="fixed top-0 left-0 right-0 z-50 hidden md:block pointer-events-none"
        style={{
          transform: isVisible ? 'translateY(0)' : 'translateY(-120%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6">
          <nav
            aria-label="Main navigation"
            className="pointer-events-auto relative flex items-center justify-between h-14 px-4 sm:px-5 rounded-xl border border-gray-200/90 backdrop-blur-[32px] saturate-[200%] bg-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
          >
            {/* Left: Brand Logo */}
            <button
              onClick={goHome}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer group shrink-0 whitespace-nowrap"
            >
              <img
                src="/logo.png"
                alt="Clean Architecture Logo"
                className="w-7 h-7 rounded-lg object-contain shadow-xs transition-transform group-hover:scale-105"
              />
              <span className="font-bold text-black text-sm tracking-tight whitespace-nowrap">
                Clean Architecture
              </span>
            </button>

            {/* Center: Centered Navigation Links (All single-line whitespace-nowrap) */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 lg:gap-1 whitespace-nowrap">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={item.onClick}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group flex items-center px-2.5 lg:px-3 py-1.5 text-xs lg:text-[13px] font-medium rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'text-black bg-black/5 font-semibold'
                        : 'text-gray-600 hover:text-black hover:bg-black/5'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center overflow-hidden transition-all duration-200 shrink-0 ${
                        isActive
                          ? 'w-4 opacity-100 mr-1.5'
                          : 'w-0 opacity-0 group-hover:w-4 group-hover:opacity-100 group-hover:mr-1.5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                    </span>
                    <span className="whitespace-nowrap leading-none">{item.label}</span>
                  </button>
                );
              })}

              {/* Divider */}
              <div className="w-px h-4 mx-1 bg-gray-200 shrink-0" />

              {/* Quick Search Button */}
              <button
                onClick={goToDocs}
                aria-label="Search documentation"
                title="Rechercher dans la documentation"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-gray-500 hover:text-black transition-colors cursor-pointer shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right: Project Charte Graphique CTA for Logout (Clean black button) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={logout}
                className="flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-lg text-white bg-black hover:bg-gray-800 active:scale-[0.98] transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Logout</span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE TOP MINI-HEADER (PROJECT CHARTE GRAPHIQUE)                         */}
      {/* ========================================================================= */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-[32px] saturate-[200%] border-b border-gray-200/80 shadow-xs">
        <div className="flex items-center justify-between py-3 px-4">
          <button
            onClick={goHome}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap"
          >
            <img
              src="/logo.png"
              alt="Clean Architecture Logo"
              className="w-6 h-6 rounded-md object-contain shadow-xs"
            />
            <span className="font-bold text-black text-sm tracking-tight whitespace-nowrap">
              Clean Architecture
            </span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            {user?.role === 'admin' && (
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-black text-white rounded-full whitespace-nowrap">
                Admin
              </span>
            )}
            <button
              onClick={logout}
              aria-label="Logout"
              title="Logout"
              className="p-1.5 text-gray-600 hover:text-black rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM FIXED PILL (PROJECT CHARTE GRAPHIQUE)                       */}
      {/* ========================================================================= */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed left-0 right-0 bottom-0 z-50 px-2 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      >
        {/* Mobile "More" Drawer / Popover if opened */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-xs z-10"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-20 mb-2 p-3 rounded-2xl border border-gray-200 backdrop-blur-[32px] saturate-[200%] shadow-[0_8px_32px_rgba(0,0,0,0.12)] bg-white/95 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Menu & Compte
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    goToProfile();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                    location.pathname === '/profile'
                      ? 'bg-black text-white font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">Settings & Profile</span>
                </button>

                {user?.role === 'admin' && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      goToAuditLogs();
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                      location.pathname === '/admin/audit-logs'
                        ? 'bg-black text-white font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Audit Logs (Admin)</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer font-medium whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">Logout</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* The Bottom Pill Bar (Monochrome project charte graphique) */}
        <div className="flex w-full py-1 px-1.5 rounded-full backdrop-blur-[32px] saturate-[200%] border border-gray-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.06)] bg-white/90">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path ? location.pathname === item.path : isMoreActive;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                aria-current={isActive ? 'page' : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 min-w-0 active:scale-90 transition-all cursor-pointer whitespace-nowrap ${
                  isActive ? 'text-black font-bold' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                <Icon className={`w-[20px] h-[20px] shrink-0 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[9.5px] tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-black -mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
