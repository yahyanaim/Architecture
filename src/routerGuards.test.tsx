import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AuthProvider } from './features/auth/context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  router,
  isAdmin,
  isAuthenticated,
  canAccessAudit,
} from './router';
import { authApi } from './features/auth/api/authApi';

vi.mock('./features/auth/api/authApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./features/auth/api/authApi')>();
  return {
    ...mod,
    authApi: {
      ...mod.authApi,
      me: vi.fn(),
      refresh: vi.fn(),
    },
  };
});

// Mock the features API endpoints so rendering pages in memory router doesn't fail on network
vi.mock('./features/admin-audit/api/auditLogsApi', () => ({
  auditLogsApi: {
    getAuditLogs: vi.fn().mockResolvedValue({
      entries: [
        {
          id: 'log-1',
          timestamp: new Date().toISOString(),
          event: 'user.login',
          actorId: 'user-1',
          orgId: 'org-1',
          details: { ip: '127.0.0.1' },
        },
      ],
      total: 1,
      limit: 15,
      offset: 0,
    }),
  },
}));

vi.mock('./features/workspaces/api/workspacesApi', () => ({
  workspacesApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    inviteMember: vi.fn(),
  },
}));

vi.mock('./features/api-keys/api/apiKeysApi', () => ({
  apiKeysApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    revoke: vi.fn(),
  },
}));

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

describe('Predicate functions', () => {
  it('isAdmin and canAccessAudit correctly evaluate admin privileges', () => {
    expect(isAdmin({ role: 'admin' })).toBe(true);
    expect(isAdmin({ role: 'user' })).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);

    expect(canAccessAudit({ role: 'admin' })).toBe(true);
    expect(canAccessAudit({ role: 'user' })).toBe(false);
    expect(canAccessAudit(null)).toBe(false);
  });

  it('isAuthenticated correctly checks authenticated user existence', () => {
    expect(isAuthenticated({ id: 'usr-123' })).toBe(true);
    expect(isAuthenticated({ id: '' })).toBe(false);
    expect(isAuthenticated(null)).toBe(false);
    expect(isAuthenticated(undefined)).toBe(false);
  });
});

describe('Router Guard & Route Access Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Guard 1: bounces unauthenticated visitors from protected routes (/workspaces) to /login', async () => {
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('unauthenticated'));

    renderAt('/workspaces');

    await waitFor(() => {
      expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
    });
  });

  it('Guard 2: renders 403 Forbidden UI when an authenticated non-admin user accesses /admin/audit-logs', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({
      id: 'usr-regular',
      name: 'Regular Member',
      email: 'member@test.com',
      role: 'user',
    });

    renderAt('/admin/audit-logs');

    await waitFor(() => {
      expect(screen.getByText(/Access Forbidden/i)).toBeInTheDocument();
      expect(
        screen.getByText(/You do not have administrative permissions to view this resource/i)
      ).toBeInTheDocument();
    });
  });

  it('Guard 3: permits authenticated admin to view /admin/audit-logs', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({
      id: 'usr-admin',
      name: 'Super Admin',
      email: 'admin@test.com',
      role: 'admin',
    });

    renderAt('/admin/audit-logs');

    await waitFor(() => {
      expect(screen.getByText(/Security & Audit Logs/i)).toBeInTheDocument();
      expect(screen.getByText(/Admin Only/i)).toBeInTheDocument();
    });
  });

  it('Guard 4: bounces unauthenticated visitors from /docs to /login', async () => {
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('unauthenticated'));

    renderAt('/docs');

    await waitFor(() => {
      expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
    });
  });

  it('Guard 5: permits authenticated regular user (role: user) to access /docs', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce({
      id: 'usr-regular',
      name: 'Regular Member',
      email: 'member@test.com',
      role: 'user',
    });

    renderAt('/docs');

    await waitFor(() => {
      expect(screen.getByText(/Du Template à la Production/i)).toBeInTheDocument();
    });
  });
});
