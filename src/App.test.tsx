import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter, MemoryRouter } from 'react-router';
import { MainApp } from './components/MainApp';
import { AuthProvider } from './features/auth/context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';

// Deterministic auth: /me rejects instantly (logged out) instead of hitting
// a real network that jsdom would hang on.
vi.mock('./features/auth/api/authApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./features/auth/api/authApi')>();
  return {
    ...mod,
    authApi: { ...mod.authApi, me: () => Promise.reject(new Error('unauthenticated')) },
  };
});

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function withProviders(ui: React.ReactElement) {
  return (
    <QueryClientProvider client={freshClient()}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>
  );
}

function renderAt(path: string) {
  const memoryRouter = createMemoryRouter(router.routes, { initialEntries: [path] });
  return render(withProviders(<RouterProvider router={memoryRouter} />));
}

describe('App Component', () => {
  it('renders the main heading', () => {
    // Header uses useNavigate: needs a Router context.
    render(withProviders(<MemoryRouter><MainApp /></MemoryRouter>));
    expect(screen.getByText(/Clean Architecture Template/i)).toBeInTheDocument();
  });

  it('renders the architect credit', () => {
    render(withProviders(<MemoryRouter><MainApp /></MemoryRouter>));
    expect(screen.getByText(/Architected by Yahia Naim/i)).toBeInTheDocument();
  });
});

describe('router guards', () => {
  it('redirects logged-out visitors from /billing to /login', async () => {
    // /me fails in tests -> logged out -> RequireAuth bounces to /login.
    renderAt('/billing');
    await waitFor(() => {
      expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
    });
  });

  it('renders the login page at /login', async () => {
    renderAt('/login');
    await waitFor(() => {
      expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
    });
  });

  it('renders pricing for logged-out visitors via redirect target', async () => {
    // /pricing is protected: logged-out users land on login, not a blank page.
    renderAt('/pricing');
    await waitFor(() => {
      expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
    });
  });
});
