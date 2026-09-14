import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiKeysApi,
  ApiKey,
  CreateApiKeyDTO,
  CreatedApiKeyResponse,
} from '../api/apiKeysApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/errors';
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<CreatedApiKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('90');

  const {
    data: apiKeys,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['api-keys'],
    queryFn: apiKeysApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateApiKeyDTO) => apiKeysApi.create(data),
    onSuccess: (newKey) => {
      setRevealedKey(newKey);
      setIsCreateOpen(false);
      setKeyName('');
      setExpiresInDays('90');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key generated successfully');
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to create API key'));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revoked');
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to revoke API key'));
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    const days = expiresInDays ? parseInt(expiresInDays, 10) : undefined;
    createMutation.mutate({
      name: keyName.trim(),
      expiresInDays: isNaN(days as number) ? undefined : days,
      scopes: ['*'],
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-black tracking-tight flex items-center gap-3">
            <KeyRound className="w-8 h-8 text-black" />
            API Keys
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage developer API keys to securely authenticate external systems with this workspace.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-black text-white hover:bg-gray-800">
              <Plus className="w-4 h-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateSubmit}>
              <DialogHeader>
                <DialogTitle>Create Developer API Key</DialogTitle>
                <DialogDescription>
                  API keys carry full workspace privileges. Give it a descriptive name to easily track its purpose.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g. GitHub Actions CI, Stripe Webhook"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-expiry">Expiration (Days)</Label>
                  <Input
                    id="key-expiry"
                    type="number"
                    min="1"
                    max="365"
                    placeholder="90"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                  />
                  <span className="text-xs text-gray-400">
                    Leave empty or set days until key expires.
                  </span>
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
                  {createMutation.isPending ? 'Generating...' : 'Generate Key'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* One-Time Secret Reveal Modal */}
      <Dialog
        open={Boolean(revealedKey)}
        onOpenChange={(open) => {
          if (!open) {
            setRevealedKey(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-2">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-gray-950">
              Save Your Secret API Key
            </DialogTitle>
            <DialogDescription className="text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs">
              <strong>Important:</strong> Please copy this secret key now. For your security, you will not be able to view this key again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-gray-500">API Key</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 border border-gray-200 p-2.5 rounded font-mono text-xs text-gray-900 break-all select-all">
                  {revealedKey?.rawKey}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => revealedKey && copyToClipboard(revealedKey.rawKey)}
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1.5 pt-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Prefix: {revealedKey?.keyPrefix}</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full bg-black text-white hover:bg-gray-800"
              onClick={() => {
                setRevealedKey(null);
                setCopied(false);
              }}
            >
              I have safely copied this key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content */}
      {isLoading && (
        <div className="py-12 text-center text-gray-500 font-medium">
          Loading API keys...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load API keys. Please check your network or permissions.
        </div>
      )}

      {!isLoading && !error && apiKeys && apiKeys.length === 0 && (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-xl bg-white p-8">
          <KeyRound className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No API keys yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Generate an API key to allow scripts, CI/CD pipelines, or backend microservices to interact with your workspace.
          </p>
        </div>
      )}

      {!isLoading && !error && apiKeys && apiKeys.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-gray-50/75">
              <TableRow>
                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Key Prefix</TableHead>
                <TableHead className="font-semibold text-gray-700">Scopes</TableHead>
                <TableHead className="font-semibold text-gray-700">Last Used</TableHead>
                <TableHead className="font-semibold text-gray-700">Created</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium text-black">
                    {key.name}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800">
                      {key.keyPrefix}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {key.scopes.map((s, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] bg-gray-100 text-gray-700 font-mono px-1.5 py-0.5 rounded"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleString()
                      : <span className="text-gray-400 italic">Never</span>}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2 gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to revoke <strong>{key.name}</strong>? Any external system or integration using this key will immediately lose access.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => revokeMutation.mutate(key.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Revoke Key
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
