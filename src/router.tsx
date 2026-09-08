import { Suspense, lazy, useEffect } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router';
import { useAuth } from '@/features/auth/context/AuthContext';
import { MainApp } from '@/components/MainApp';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { UPGRADE_REQUIRED_EVENT } from '@/lib/axios';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

// Route-level code splitting: each page is its own chunk so the initial
// load is just shell + MainApp. Named exports need the default remap.
const ProfileSettings = lazy(() =>
  import('@/features/profile/pages/ProfileSettings').then((m) => ({ default: m.ProfileSettings }))
);
const PricingPage = lazy(() =>
  import('@/features/billing/pages/PricingPage').then((m) => ({ default: m.PricingPage }))
);
const BillingSettings = lazy(() =>
  import('@/features/billing/pages/BillingSettings').then((m) => ({ default: m.BillingSettings }))
);
const InvitePage = lazy(() =>
  import('@/features/auth/pages/InvitePage').then((m) => ({ default: m.InvitePage }))
);
const ResetPasswordPage = lazy(() =>
  import('@/features/auth/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);

// ============================================================================
// URL routing (replaces the old state-based AuthRoute). Every page is now a
// real path: deep-linkable, back-button-safe, refresh-stable. Guards are
// structural — a new protected page just nests under RequireAuth instead of
// remembering an `if (!user)` check.
// ============================================================================

function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-black font-medium">Loading...</div>
    </div>
  );
}

/**
 * Route chrome: per-route document titles (bookmarks/SR) + scroll reset.
 * Accessibility: route changes announce via title and start at top instead
 * of preserving the previous page's scroll position.
 */
const TITLES: Record<string, string> = {
  '/': 'Clean Architecture',
  '/login': 'Sign in — Clean Architecture',
  '/register': 'Create account — Clean Architecture',
  '/profile': 'Settings — Clean Architecture',
  '/pricing': 'Pricing — Clean Architecture',
  '/billing': 'Billing — Clean Architecture',
  '/invite': 'Accept invite — Clean Architecture',
  '/reset-password': 'Reset password — Clean Architecture',
};

function RouteChrome() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] ?? 'Clean Architecture';
    window.scrollTo(0, 0);
  }, [pathname]);
  return <Outlet />;
}

/** Structural auth guard: logged-out visitors bounce to /login. */
function RequireAuth() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Inverse guard: logged-in users skip auth pages straight to the app. */
function GuestOnly() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

/**
 * Global plan-gate handler: any API 403 with code 'upgrade_required'
 * (dispatched by the axios interceptor) navigates to pricing. Lives inside
 * the Router so it can use useNavigate directly — no window-event
 * indirection beyond the interceptor dispatch itself.
 */
function UpgradeRedirector() {
  const navigate = useNavigate();
  useEffect(() => {
    const goPricing = () => navigate('/pricing');
    window.addEventListener(UPGRADE_REQUIRED_EVENT, goPricing);
    return () => window.removeEventListener(UPGRADE_REQUIRED_EVENT, goPricing);
  }, [navigate]);
  // Single-outlet chain: redirector -> chrome -> page (sibling Outlets
  // would render children twice).
  return <RouteChrome />;
}

function ProfileRoute() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <Header />
      <main className="flex-grow w-full py-8 px-4">
        <ProfileSettings />
      </main>
      <Footer />
    </div>
  );
}

function PricingRoute() {
  const navigate = useNavigate();
  return <PricingPage onBack={() => navigate('/')} />;
}

function BillingRoute() {
  const navigate = useNavigate();
  return (
    <BillingSettings
      onBack={() => navigate('/')}
      onNavigateToPricing={() => navigate('/pricing')}
    />
  );
}

export const router = createBrowserRouter([
  {
    // RouteChrome (titles/scroll) wraps everything; UpgradeRedirector needs
    // Router context for useNavigate, so both sit above the page routes.
    element: <UpgradeRedirector />,
    children: [
      { path: '/', element: <RequireAuth />, children: [{ index: true, element: <MainApp /> }] },
      { path: '/profile', element: <RequireAuth />, children: [{ index: true, element: <Suspense fallback={<Loading />}><ProfileRoute /></Suspense> }] },
      { path: '/pricing', element: <RequireAuth />, children: [{ index: true, element: <Suspense fallback={<Loading />}><PricingRoute /></Suspense> }] },
      { path: '/billing', element: <RequireAuth />, children: [{ index: true, element: <Suspense fallback={<Loading />}><BillingRoute /></Suspense> }] },
      {
        path: '/login',
        element: <GuestOnly />,
        children: [{ index: true, element: <LoginPage /> }],
      },
      {
        path: '/register',
        element: <GuestOnly />,
        children: [{ index: true, element: <RegisterPage /> }],
      },
      // Token links from emails (public by design — the token IS the credential).
      { path: '/invite', element: <Suspense fallback={<Loading />}><InvitePage /></Suspense> },
      { path: '/reset-password', element: <Suspense fallback={<Loading />}><ResetPasswordPage /></Suspense> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
