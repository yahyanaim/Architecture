import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      // Don't retry client errors: a 401/403/404 will fail identically on
      // retry (wasted request + delayed redirect/toast). Retry once otherwise.
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error) && error.response) {
          const status = error.response.status;
          if (status === 401 || status === 403 || status === 404 || status === 422) return false;
        }
        return failureCount < 1;
      },
    },
  },
});
