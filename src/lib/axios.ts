import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Event name the router listens for (see router.tsx UpgradeRedirector) to
// route plan-gated 403s.
export const UPGRADE_REQUIRED_EVENT = 'billing:upgrade-required';

let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

// Global response interceptor:
// 1. Upgrade gate (403 + upgrade_required -> route to pricing)
// 2. Token refresh (401 -> call /auth/refresh and retry once)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as (typeof error.config & { _retry?: boolean });
    const status = error.response?.status;

    // 1. Plan gate handler: route to pricing
    if (
      status === 403 &&
      (error.response?.data as { code?: string } | undefined)?.code === 'upgrade_required'
    ) {
      window.dispatchEvent(new CustomEvent(UPGRADE_REQUIRED_EVENT));
      return Promise.reject(error);
    }

    // 2. Automatic session refresh on 401:
    // Skip if already retried, or if this request was itself an auth attempt
    const url = originalRequest?.url ?? '';
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = apiClient.post('/auth/refresh').finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
        }

        await refreshPromise;
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
