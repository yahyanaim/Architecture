import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { AuthProvider } from '../context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authApi } from '../api/authApi';

// Full interaction coverage for entry forms: validation blocks bad
// input before any network call; valid input reaches the API.
vi.mock('../api/authApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../api/authApi')>();
  return {
    ...mod,
    authApi: {
      ...mod.authApi,
      me: () => Promise.reject(new Error('unauthenticated')),
      login: vi.fn(),
      register: vi.fn(),
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    },
  };
});

const loginMock = authApi.login as unknown as ReturnType<typeof vi.fn>;
const registerMock = authApi.register as unknown as ReturnType<typeof vi.fn>;
const requestResetMock = authApi.requestPasswordReset as unknown as ReturnType<typeof vi.fn>;
const resetPasswordMock = authApi.resetPassword as unknown as ReturnType<typeof vi.fn>;

function renderWithProviders(ui: React.ReactElement, initialEntries: string[] = ['/']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginPage submission', () => {
  it('blocks empty submit with field errors and no API call', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('calls login with valid input', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValueOnce({ id: '1', name: 'A', email: 'a@x.com', role: 'user' });
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@x.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'anything');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('a@x.com', 'anything');
    });
  });

  it('renders Google, GitHub and Passkey login options with correct attributes', () => {
    renderWithProviders(<LoginPage />);

    const googleBtn = screen.getByRole('link', { name: /google/i });
    expect(googleBtn).toHaveAttribute('href', '/api/v1/auth/oauth/google/url?redirect=true');

    const githubBtn = screen.getByRole('link', { name: /github/i });
    expect(githubBtn).toHaveAttribute('href', '/api/v1/auth/oauth/github/url?redirect=true');

    expect(screen.getByRole('button', { name: /passkey/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot password\?/i })).toHaveAttribute('href', '/forgot-password');
  });
});

describe('RegisterPage submission', () => {
  it('blocks mismatched passwords before any API call', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByPlaceholderText('John Doe'), 'John Doe');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'john@x.com');
    const passwords = screen.getAllByPlaceholderText('••••••••');
    await user.type(passwords[0]!, 'Valid1234');
    await user.type(passwords[1]!, 'Different1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('renders Google and GitHub register options', () => {
    renderWithProviders(<RegisterPage />);

    const googleBtn = screen.getByRole('link', { name: /google/i });
    expect(googleBtn).toHaveAttribute('href', '/api/v1/auth/oauth/google/url?redirect=true');

    const githubBtn = screen.getByRole('link', { name: /github/i });
    expect(githubBtn).toHaveAttribute('href', '/api/v1/auth/oauth/github/url?redirect=true');
  });
});

describe('ForgotPasswordPage', () => {
  it('shows validation error for empty or invalid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(requestResetMock).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText('Invalid email format')).toBeInTheDocument();
    expect(requestResetMock).not.toHaveBeenCalled();
  });

  it('submits reset request on valid email and displays confirmation', async () => {
    const user = userEvent.setup();
    requestResetMock.mockResolvedValueOnce({ message: 'Reset email sent' });
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(requestResetMock).toHaveBeenCalledWith('user@example.com');
    });
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
  });
});

describe('ResetPasswordPage', () => {
  it('falls back to ForgotPasswordPage when no token is present', () => {
    renderWithProviders(<ResetPasswordPage />, ['/reset-password']);
    expect(screen.getByRole('heading', { name: /forgot password/i })).toBeInTheDocument();
  });

  it('renders reset password form when token is provided and validates matching passwords', async () => {
    const user = userEvent.setup();
    resetPasswordMock.mockResolvedValueOnce({ message: 'Password updated' });

    renderWithProviders(
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>,
      ['/reset-password?token=secret123']
    );

    expect(screen.getByRole('heading', { name: /set a new password/i })).toBeInTheDocument();

    const inputs = screen.getAllByPlaceholderText('••••••••');
    await user.type(inputs[0]!, 'NewValid1234');
    await user.type(inputs[1]!, 'NewValid1234');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(resetPasswordMock).toHaveBeenCalledWith('secret123', 'NewValid1234', 'NewValid1234');
    });
  });
});
