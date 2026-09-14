import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  workspacesApi,
  Workspace,
  CreateWorkspaceDTO,
  InviteMemberDTO,
} from '../api/workspacesApi';
import { WorkspaceWebhooksSection } from '../components/WorkspaceWebhooksSection';
import { setActiveOrgId } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/errors';
import {
  Building2,
  CheckCircle2,
  Plus,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export function WorkspacesPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const {
    data: workspaces,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateWorkspaceDTO) => workspacesApi.create(data),
    onSuccess: (newWorkspace) => {
      toast.success(`Workspace "${newWorkspace.name}" created`);
      setIsCreateOpen(false);
      setNewWorkspaceName('');
      setActiveOrgId(newWorkspace.id);
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries();
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to create workspace'));
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteMemberDTO) => workspacesApi.inviteMember(data),
    onSuccess: (res) => {
      toast.success(`Invite sent to ${res.email}`);
      setIsInviteOpen(false);
      setInviteName('');
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to invite member'));
    },
  });

  const handleSwitchWorkspace = (workspace: Workspace) => {
    setActiveOrgId(workspace.id);
    toast.success(`Switched to ${workspace.name}`);
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    queryClient.invalidateQueries();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    createMutation.mutate({ name: newWorkspaceName.trim() });
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    inviteMutation.mutate({ name: inviteName.trim(), email: inviteEmail.trim() });
  };

  const currentWorkspace = workspaces?.find((w) => w.isCurrent) ?? workspaces?.[0];
  const canInvite = currentWorkspace?.role === 'admin';

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-black tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-black" />
            Workspaces
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage your organizations, switch active workspaces, and invite team members.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canInvite && (
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleInviteSubmit}>
                  <DialogHeader>
                    <DialogTitle>Invite Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join{' '}
                      <span className="font-semibold text-black">
                        {currentWorkspace?.name}
                      </span>
                      . They will receive an email to activate their account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-name">Full Name</Label>
                      <Input
                        id="invite-name"
                        placeholder="e.g. Jane Doe"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-email">Email Address</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="jane@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsInviteOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={inviteMutation.isPending}
                      className="bg-black text-white hover:bg-gray-800"
                    >
                      {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-black text-white hover:bg-gray-800">
                <Plus className="w-4 h-4" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Workspace</DialogTitle>
                  <DialogDescription>
                    Workspaces provide dedicated multi-tenant isolation, billing plans, and team memberships.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Workspace Name</Label>
                    <Input
                      id="workspace-name"
                      placeholder="e.g. Acme Corp"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-black text-white hover:bg-gray-800"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="py-12 text-center text-gray-500 font-medium">
          Loading workspaces...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load workspaces. Please refresh or try again later.
        </div>
      )}

      {!isLoading && !error && workspaces && workspaces.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No workspaces found. Create your first workspace above!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workspaces?.map((ws) => (
          <Card
            key={ws.id}
            className={`transition-all relative flex flex-col justify-between ${
              ws.isCurrent
                ? 'border-2 border-black shadow-md bg-white'
                : 'border border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-bold text-black flex items-center gap-2">
                    {ws.name}
                    {ws.isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Current
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-400 font-mono">
                    /{ws.slug}
                  </CardDescription>
                </div>

                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {ws.plan}
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-xs text-gray-600 flex-grow">
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Your Role
                </span>
                <span className="font-semibold capitalize text-gray-900">
                  {ws.role}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Member Since
                </span>
                <span className="text-gray-900">
                  {new Date(ws.joinedAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>

            <div className="p-6 pt-0">
              {ws.isCurrent ? (
                <Button
                  disabled
                  variant="outline"
                  className="w-full text-xs cursor-default bg-gray-50 text-gray-500 border-gray-200"
                >
                  Active Workspace
                </Button>
              ) : (
                <Button
                  onClick={() => handleSwitchWorkspace(ws)}
                  variant="outline"
                  className="w-full text-xs gap-1.5 hover:bg-black hover:text-white transition-colors"
                >
                  <span>Switch Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <WorkspaceWebhooksSection />
    </div>
  );
}
