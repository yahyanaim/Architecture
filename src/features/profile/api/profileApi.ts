import { apiClient } from '@/lib/axios';

export interface Profile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export const profileApi = {
  getProfile: async (): Promise<Profile> => {
    const response = await apiClient.get<Profile>('/profile');
    return response.data;
  },

  updateProfile: async (data: UpdateProfileInput): Promise<Profile> => {
    const response = await apiClient.put<Profile>('/profile', data);
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await apiClient.put<{ message: string }>('/profile/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  deleteAccount: async (): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>('/profile');
    return response.data;
  },
};