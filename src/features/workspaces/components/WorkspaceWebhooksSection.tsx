import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  webhooksApi,
  WebhookEndpoint,
  WebhookDelivery,
} from '../api/webhooksApi';
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
  Webhook,
  Plus,
  Trash2,
  Send,
  History,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

function generateRandomSecret(): string {
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  return 'whsec_' + Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function WorkspaceWebhooksSection() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [secret, setSecret] = useState(generateRandomSecret());
  const [eventsInput, setEventsInput] = useState('user.*, billing.*, org.*');
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null);

  // Deliveries modal state
  const [selectedEndpoint, setSelectedEndpoint] = useState<WebhookEndpoint | null>(null);
  const [isDeliveriesOpen, setIsDeliveriesOpen] = useState(false);

  const { data: endpoints = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: webhooksApi.list,
  });

  const { data: deliveries = [], isLoading: isLoadingDeliveries, refetch: refetchDeliveries } = useQuery({
    queryKey: ['webhook-deliveries', selectedEndpoint?.id],
    queryFn: () => (selectedEndpoint ? webhooksApi.listDeliveries(selectedEndpoint.id) : Promise.resolve([])),
    enabled: Boolean(selectedEndpoint && isDeliveriesOpen),
  });

  const createMutation = useMutation({
    mutationFn: webhooksApi.create,
    onSuccess: () => {
      toast.success('Webhook endpoint registered');
      setIsAddOpen(false);
      setUrl('');
      setDescription('');
      setSecret(generateRandomSecret());
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to create webhook endpoint'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: webhooksApi.delete,
    onSuccess: () => {
      toast.success('Webhook endpoint removed');
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to delete webhook endpoint'));
    },
  });

  const testPingMutation = useMutation({
    mutationFn: (endpointId: string) => webhooksApi.testPing(endpointId),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Ping succeeded: HTTP ${data.statusCode} (${data.durationMs}ms)`);
      } else {
        toast.error(`Ping failed: ${data.error || `HTTP ${data.statusCode}`}`);
      }
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries'] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Ping request failed'));
    },
  });

  const replayMutation = useMutation({
    mutationFn: (deliveryId: string) => webhooksApi.replayDelivery(deliveryId),
    onSuccess: () => {
      toast.success('Delivery re-queued for dispatch');
      refetchDeliveries();
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to replay delivery'));
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const parsedEvents = eventsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    createMutation.mutate({
      url: url.trim(),
      description: description.trim() || undefined,
      secret: secret.trim() || undefined,
      events: parsedEvents.length > 0 ? parsedEvents : ['*'],
    });
  };

  const copySecret = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecretId(id);
    setTimeout(() => setCopiedSecretId(null), 2000);
    toast.info('Secret copied to clipboard');
  };

  const toggleReveal = (id: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Card className="border-border/60 shadow-sm mt-8">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Outbound Webhooks</CardTitle>
          </div>
          <CardDescription className="mt-1">
            Send real-time signed HTTP notifications for workspace, user, and billing events via the transactional outbox.
          </CardDescription>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Webhook Endpoint</DialogTitle>
              <DialogDescription>
                We will send an HMAC-SHA256 signed POST request to this URL whenever subscribed events fire.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Endpoint URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://api.yourdomain.com/webhooks"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="webhook-secret">Signing Secret</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setSecret(generateRandomSecret())}
                  >
                    Regenerate
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="webhook-secret"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    required
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => copySecret(secret, 'dialog')}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {copiedSecretId === 'dialog' ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-events">Subscribed Events</Label>
                <Input
                  id="webhook-events"
                  placeholder="user.*, billing.*, org.* or *"
                  value={eventsInput}
                  onChange={(e) => setEventsInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated patterns (e.g. <code>user.*</code>, <code>billing.*</code>, or <code>*</code> for all).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-desc">Description (Optional)</Label>
                <Input
                  id="webhook-desc"
                  placeholder="Primary Zapier / Slack integration"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Registering...' : 'Register Endpoint'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading webhook endpoints...
          </div>
        ) : endpoints.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Webhook className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
            <h3 className="font-semibold text-base mb-1">No webhooks configured</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              Add your first HTTP endpoint to receive real-time updates when users, workspaces, or subscriptions change.
            </p>
            <Button size="sm" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Webhook
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Subscribed Events</TableHead>
                  <TableHead>Signing Secret</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((ep) => {
                  const isRevealed = revealedSecrets[ep.id] ?? false;
                  return (
                    <TableRow key={ep.id}>
                      <TableCell className="max-w-[280px]">
                        <div className="font-mono text-xs truncate font-medium">{ep.url}</div>
                        {ep.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {ep.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {ep.events.map((ev) => (
                            <span
                              key={ev}
                              className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-mono font-medium text-secondary-foreground"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span>
                            {isRevealed
                              ? ep.secret
                              : ep.secret.slice(0, 8) + '••••••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleReveal(ep.id)}
                            className="text-muted-foreground hover:text-foreground"
                            title={isRevealed ? 'Hide secret' : 'Reveal secret'}
                          >
                            {isRevealed ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => copySecret(ep.secret, ep.id)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Copy secret"
                          >
                            {copiedSecretId === ep.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => testPingMutation.mutate(ep.id)}
                            disabled={testPingMutation.isPending}
                            title="Send signed test ping"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Test Ping</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => {
                              setSelectedEndpoint(ep);
                              setIsDeliveriesOpen(true);
                            }}
                            title="View recent delivery attempts"
                          >
                            <History className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Deliveries</span>
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Delete endpoint"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Webhook Endpoint?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently stop delivering event notifications to{' '}
                                  <code className="font-mono text-xs">{ep.url}</code>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  onClick={() => deleteMutation.mutate(ep.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Deliveries Dialog */}
        <Dialog open={isDeliveriesOpen} onOpenChange={setIsDeliveriesOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <History className="h-4 w-4" /> Recent Webhook Deliveries
                  </DialogTitle>
                  <DialogDescription className="mt-1 font-mono text-xs truncate max-w-md">
                    {selectedEndpoint?.url}
                  </DialogDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchDeliveries()}
                  className="h-8 gap-1 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-2">
              {isLoadingDeliveries ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Loading deliveries...
                </div>
              ) : deliveries.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No delivery attempts recorded yet. Try sending a Test Ping!
                </div>
              ) : (
                <div className="space-y-3">
                  {deliveries.map((d: WebhookDelivery) => (
                    <div
                      key={d.id}
                      className="rounded-lg border p-3.5 text-xs space-y-2 bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-medium">
                          {d.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> 200 OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                              <AlertCircle className="h-3.5 w-3.5" />{' '}
                              {d.responseStatus ? `HTTP ${d.responseStatus}` : 'Failed'}
                            </span>
                          )}
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">
                            {d.eventType}
                          </span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                          {d.durationMs != null && <span>{d.durationMs}ms</span>}
                          <span>{new Date(d.createdAt).toLocaleTimeString()}</span>
                          {d.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[11px] px-2"
                              onClick={() => replayMutation.mutate(d.id)}
                              disabled={replayMutation.isPending}
                            >
                              Replay
                            </Button>
                          )}
                        </div>
                      </div>

                      {d.error && (
                        <div className="rounded bg-rose-50 dark:bg-rose-950/40 p-2 text-rose-700 dark:text-rose-300 font-mono text-[11px]">
                          {d.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeliveriesOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
