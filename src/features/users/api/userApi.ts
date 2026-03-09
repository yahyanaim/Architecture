import { apiClient } from '@/lib/axios';
import { User, CreateUserDTO } from '../types';

export const userApi = {
  getUsers: async (): Promise<User[]> => {
    const response = await apiClient.get('/users');
    return response.data;
  },

  createUser: async (data: CreateUserDTO): Promise<User> => {
    const response = await apiClient.post('/users', data);
    return response.data;
  },

  toggleStatus: async (id: string): Promise<User> => {
    const response = await apiClient.patch(`/users/${id}/status`);
    return response.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  }
};
