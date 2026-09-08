import { apiClient } from '@/lib/axios';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  // Added by the SaaS auth upgrade (backward-compatible: optional here, the
  // login/register pages ignore them; sessions live in httpOnly cookies).
  emailVerified?: boolean;
  orgId?: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (name: string, email: string, password: string, confirmPassword: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', { name, email, password, confirmPassword });
    return response.data;
  },

  acceptInvite: async (token: string, password: string, confirmPassword: string, name?: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/invite-accept', { token, password, confirmPassword, name });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string, confirmNewPassword: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/password-reset', { token, newPassword, confirmNewPassword });
    return response.data;
  },

  me: async (): Promise<AuthUser> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  refresh: async (): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },
};
