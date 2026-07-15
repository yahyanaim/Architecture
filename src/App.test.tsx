import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MainApp } from './components/MainApp';
import { AuthProvider } from './features/auth/context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>
  );
};

describe('App Component', () => {
  it('renders the main heading', () => {
    renderWithProviders(<MainApp />);
    const heading = screen.getByText(/Clean Architecture Template/i);
    expect(heading).toBeInTheDocument();
  });

  it('renders the architect credit', () => {
    renderWithProviders(<MainApp />);
    const credit = screen.getByText(/Architected by Yahia Naim/i);
    expect(credit).toBeInTheDocument();
  });
});
