import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { AuthProvider } from '../context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authApi } from '../api/authApi';

// Full interaction coverage for the two entry forms: validation blocks bad
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
    },
  };
});

const loginMock = authApi.login as unknown as ReturnType<typeof vi.fn>;
const registerMock = authApi.register as unknown as ReturnType<typeof vi.fn>;

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
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
});
