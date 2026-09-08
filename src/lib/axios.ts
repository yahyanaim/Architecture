import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Event name the app listens for (see AuthRoute) to route plan-gated 403s.
export const UPGRADE_REQUIRED_EVENT = 'billing:upgrade-required';

// Global plan-gate handler: any API call rejected with 403 +
// code 'upgrade_required' routes to the pricing page instead of surfacing a
// generic error. The error is still rethrown so callers can toast/cleanup.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 403 &&
      (error.response.data as { code?: string } | undefined)?.code === 'upgrade_required'
    ) {
      window.dispatchEvent(new CustomEvent(UPGRADE_REQUIRED_EVENT));
    }
    return Promise.reject(error);
  }
);
