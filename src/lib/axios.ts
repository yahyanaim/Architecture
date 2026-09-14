import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Event name the router listens for (see router.tsx UpgradeRedirector) to
// route plan-gated 403s.
export const UPGRADE_REQUIRED_EVENT = 'billing:upgrade-required';
export const ACTIVE_ORG_STORAGE_KEY = 'active_org_id';

export function getActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
}

export function setActiveOrgId(orgId: string | null): void {
  if (typeof window === 'undefined') return;
  if (orgId) {
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
    document.cookie = `active_org_id=${orgId}; path=/; max-age=2592000; SameSite=Lax`;
  } else {
    localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
    document.cookie = `active_org_id=; path=/; max-age=0; SameSite=Lax`;
  }
}

apiClient.interceptors.request.use((config) => {
  const activeOrg = getActiveOrgId();
  if (activeOrg && config.headers) {
    config.headers['X-Organization-Id'] = activeOrg;
  }
  return config;
});

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
