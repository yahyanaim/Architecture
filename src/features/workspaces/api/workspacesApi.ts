import { z } from 'zod';
import { apiClient } from '@/lib/axios';

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  plan: z.enum(['free', 'pro', 'enterprise']).or(z.string()),
  status: z.string(),
  role: z.enum(['admin', 'member']).or(z.string()),
  joinedAt: z.string(),
  isCurrent: z.boolean(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
});

export type CreateWorkspaceDTO = z.infer<typeof CreateWorkspaceSchema>;

export const InviteMemberSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

export type InviteMemberDTO = z.infer<typeof InviteMemberSchema>;

export const workspacesApi = {
  list: async (): Promise<Workspace[]> => {
    const response = await apiClient.get('/workspaces');
    return z.array(WorkspaceSchema).parse(response.data);
  },

  create: async (data: CreateWorkspaceDTO): Promise<Workspace> => {
    CreateWorkspaceSchema.parse(data);
    const response = await apiClient.post('/workspaces', data);
    return WorkspaceSchema.parse(response.data);
  },

  inviteMember: async (data: InviteMemberDTO): Promise<{ id: string; name: string; email: string }> => {
    InviteMemberSchema.parse(data);
    const response = await apiClient.post('/users', data);
    return response.data;
  },
};
