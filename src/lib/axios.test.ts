import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { apiClient, UPGRADE_REQUIRED_EVENT } from './axios';

describe('axios interceptors', () => {
  const originalAdapter = apiClient.defaults.adapter;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('dispatches UPGRADE_REQUIRED_EVENT on 403 upgrade_required', async () => {
    let eventDispatched = false;
    const listener = () => {
      eventDispatched = true;
    };
    window.addEventListener(UPGRADE_REQUIRED_EVENT, listener);

    apiClient.defaults.adapter = async (config) => {
      const error: any = new Error('Request failed with status code 403');
      error.isAxiosError = true;
      error.config = config;
      error.response = {
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config,
        data: { code: 'upgrade_required' },
      };
      throw error;
    };

    await expect(apiClient.get('/features/pro')).rejects.toBeDefined();
    expect(eventDispatched).toBe(true);
    window.removeEventListener(UPGRADE_REQUIRED_EVENT, listener);
  });

  it('attempts to refresh session on 401 and retries original request', async () => {
    let refreshCalls = 0;
    let dataCalls = 0;

    apiClient.defaults.adapter = async (config) => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCalls += 1;
        return {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      }

      dataCalls += 1;
      if (dataCalls === 1) {
        // First attempt fails with 401
        const error: any = new Error('Request failed with status code 401');
        error.isAxiosError = true;
        error.config = config;
        error.response = {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
          data: { message: 'Unauthorized' },
        };
        throw error;
      }

      // Second attempt (retry) succeeds
      return {
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    const res = await apiClient.get('/data');
    expect(refreshCalls).toBe(1);
    expect(dataCalls).toBe(2);
    expect(res.data).toEqual({ message: 'success' });
  });
});
