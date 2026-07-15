import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/react-query';
import { Toaster } from '@/components/ui/sonner';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthRoute } from './components/AuthRoute';

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthRoute />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
