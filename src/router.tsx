import { useEffect } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useNavigate,
} from 'react-router';
import { useAuth } from '@/features/auth/context/AuthContext';
import { MainApp } from '@/components/MainApp';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ProfileSettings } from '@/features/profile/pages/ProfileSettings';
import { PricingPage } from '@/features/billing/pages/PricingPage';
import { BillingSettings } from '@/features/billing/pages/BillingSettings';
import { InvitePage } from '@/features/auth/pages/InvitePage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { UPGRADE_REQUIRED_EVENT } from '@/lib/axios';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

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
  return <Outlet />;
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
    element: <UpgradeRedirector />,
    children: [
      { path: '/', element: <RequireAuth />, children: [{ index: true, element: <MainApp /> }] },
      { path: '/profile', element: <RequireAuth />, children: [{ index: true, element: <ProfileRoute /> }] },
      { path: '/pricing', element: <RequireAuth />, children: [{ index: true, element: <PricingRoute /> }] },
      { path: '/billing', element: <RequireAuth />, children: [{ index: true, element: <BillingRoute /> }] },
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
      { path: '/invite', element: <InvitePage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
