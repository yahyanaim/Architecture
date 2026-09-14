import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogsApi } from '../api/auditLogsApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ShieldCheck,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Terminal,
} from 'lucide-react';

const PAGE_SIZE = 15;

export function AdminAuditPage() {
  const [eventFilter, setEventFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [appliedEvent, setAppliedEvent] = useState<string | undefined>(undefined);
  const [appliedActor, setAppliedActor] = useState<string | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-audit-logs', appliedEvent, appliedActor, offset],
    queryFn: () =>
      auditLogsApi.getAuditLogs({
        event: appliedEvent || undefined,
        actorId: appliedActor || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
  });

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setAppliedEvent(eventFilter.trim() || undefined);
    setAppliedActor(actorFilter.trim() || undefined);
  };

  const handleClearFilter = () => {
    setEventFilter('');
    setActorFilter('');
    setAppliedEvent(undefined);
    setAppliedActor(undefined);
    setOffset(0);
  };

  const total = data?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-black text-white">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Only
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-black tracking-tight">
            Security & Audit Logs
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Immutable system audit trail tracking administrative actions, user changes, and API events.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters Form */}
      <form
        onSubmit={handleApplyFilter}
        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-end"
      >
        <div className="flex-1 space-y-1">
          <label className="text-xs font-semibold text-gray-700">Event Name</label>
          <div className="relative">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="e.g. user.login, api_key.created"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <label className="text-xs font-semibold text-gray-700">Actor ID</label>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Filter by actor UUID"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            className="bg-black text-white hover:bg-gray-800 text-xs px-4"
          >
            Apply Filters
          </Button>
          {(appliedEvent || appliedActor || eventFilter || actorFilter) && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClearFilter}
              className="text-xs"
            >
              Clear
            </Button>
          )}
        </div>
      </form>

      {/* Content */}
      {isLoading && (
        <div className="py-12 text-center text-gray-500 font-medium">
          Loading audit events...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load audit logs. Ensure you have admin privileges.
        </div>
      )}

      {!isLoading && !error && data && data.entries.length === 0 && (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-xl bg-white p-8">
          <Terminal className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No audit logs found</h3>
          <p className="text-xs text-gray-500 mt-1">
            No events match the specified filter criteria.
          </p>
        </div>
      )}

      {!isLoading && !error && data && data.entries.length > 0 && (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <Table>
              <TableHeader className="bg-gray-50/75">
                <TableRow>
                  <TableHead className="font-semibold text-gray-700">Timestamp</TableHead>
                  <TableHead className="font-semibold text-gray-700">Event</TableHead>
                  <TableHead className="font-semibold text-gray-700">Actor ID</TableHead>
                  <TableHead className="font-semibold text-gray-700">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-900">
                        {entry.event}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-gray-500">
                      {entry.actorId}
                    </TableCell>
                    <TableCell className="text-xs">
                      <pre className="bg-gray-50 p-2 rounded border border-gray-100 font-mono text-[11px] text-gray-700 overflow-x-auto max-w-md">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between text-xs text-gray-600 px-2">
            <div>
              Showing {data.entries.length > 0 ? offset + 1 : 0} to{' '}
              {Math.min(offset + PAGE_SIZE, total)} of {total} events
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="gap-1 h-8 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>
              <span className="px-2 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="gap-1 h-8 text-xs"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
