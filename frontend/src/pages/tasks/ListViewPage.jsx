/**
 * Feature 6 — List View Page
 * Full-featured task table with search, multi-filter, sort, pagination, bulk actions, saved filters.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Filter, ChevronDown, ChevronUp, X, Check, Plus, Save, Trash2,
  ArrowUpDown, RefreshCw, Square, CheckSquare, MoreHorizontal, Calendar,
  Flag, User, Tag, ListFilter, Bookmark, AlertCircle,
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { tasksApi, savedFiltersApi, taskKeys, savedFilterKeys } from '../../lib/taskApi';
import { PriorityBadge, StatusBadge, LabelBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Dialog } from '../../components/ui/Dialog';
import { Alert, extractError } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/Spinner';

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];
const TASK_PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'];
const SORT_FIELDS = [
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
];
const PAGE_SIZES = [10, 25, 50, 100];

// ── Debounce hook ──────────────────────────────────────────────────────────────
function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger }) => (
  <Dialog isOpen={isOpen} onClose={onClose} title={title} size="sm"
    footer={
      <>
        <button className="btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        <button className={`btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </>
    }>
    <p className="text-sm text-surface-600">{message}</p>
  </Dialog>
);

// ── Save Filter Dialog ─────────────────────────────────────────────────────────
const SaveFilterDialog = ({ isOpen, onClose, onSave, currentFilters, currentSort }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const handleSave = () => {
    if (!name.trim()) { setError('Name is required'); return; }
    onSave({ name: name.trim(), filters: currentFilters, sortField: currentSort.field, sortDir: currentSort.dir });
    setName('');
    onClose();
  };
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Save Current View" size="sm"
      footer={<><button className="btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn-primary btn-sm" onClick={handleSave}>Save</button></>}>
      <div className="space-y-3">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder="e.g., My Open Tasks"
          className="input"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
      </div>
    </Dialog>
  );
};

// ── Bulk Action Bar ────────────────────────────────────────────────────────────
const BulkActionBar = ({ selectedIds, onClear, onAction, members, projects }) => {
  const [open, setOpen] = useState(false);
  const count = selectedIds.length;
  if (count === 0) return null;

  const actions = [
    { label: 'Set Status', sub: TASK_STATUSES.map((s) => ({ label: s.replace('_', ' '), action: () => onAction('set_status', s) })) },
    { label: 'Set Priority', sub: TASK_PRIORITIES.map((p) => ({ label: p, action: () => onAction('set_priority', p) })) },
    { label: 'Delete Selected', action: () => onAction('delete', null), danger: true },
  ];

  return (
    <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-2.5 animate-slide-up">
      <CheckSquare size={15} className="text-primary-600" />
      <span className="text-sm font-medium text-primary-700">{count} selected</span>
      <div className="flex-1" />
      {actions.map((a) => (
        <div key={a.label} className="relative">
          {a.sub ? (
            <>
              <button className="btn-ghost btn-sm flex items-center gap-1" onClick={() => setOpen(open === a.label ? false : a.label)}>
                {a.label} <ChevronDown size={12} />
              </button>
              {open === a.label && (
                <div className="dropdown absolute bottom-full mb-1 left-0 min-w-[140px]">
                  {a.sub.map((s) => (
                    <button key={s.label} className="dropdown-item capitalize text-xs" onClick={() => { s.action(); setOpen(false); }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <button className={`btn-sm ${a.danger ? 'btn-danger' : 'btn-ghost'}`} onClick={a.action}>
              {a.label}
            </button>
          )}
        </div>
      ))}
      <button className="btn-ghost btn-sm" onClick={onClear}><X size={14} /></button>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export const ListViewPage = () => {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters from URL params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilters, setStatusFilters] = useState(searchParams.getAll('status'));
  const [priorityFilters, setPriorityFilters] = useState(searchParams.getAll('priority'));
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdue') === 'true');
  const [sortField, setSortField] = useState(searchParams.get('sort') || 'createdAt');
  const [sortDir, setSortDir] = useState(searchParams.get('dir') || 'desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // UI state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(null);
  const [bulkError, setBulkError] = useState('');

  const debouncedSearch = useDebounce(search, 400);

  // Sync URL params
  useEffect(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilters.length) params.status = statusFilters;
    if (priorityFilters.length) params.priority = priorityFilters;
    if (overdueOnly) params.overdue = 'true';
    if (sortField !== 'createdAt') params.sort = sortField;
    if (sortDir !== 'desc') params.dir = sortDir;
    setSearchParams(params, { replace: true });
    setPage(1);
  }, [debouncedSearch, statusFilters, priorityFilters, overdueOnly, sortField, sortDir]);

  const queryParams = {
    search: debouncedSearch || undefined,
    status: statusFilters.length === 1 ? statusFilters[0] : undefined,
    priority: priorityFilters.length === 1 ? priorityFilters[0] : undefined,
    overdue: overdueOnly ? 'true' : undefined,
    sort: sortField,
    dir: sortDir,
    page,
    limit: pageSize,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: taskKeys.list(activeWorkspaceId, queryParams),
    queryFn: () => tasksApi.list(activeWorkspaceId, queryParams),
    enabled: !!activeWorkspaceId,
    keepPreviousData: true,
  });

  const tasks = data?.tasks || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Saved filters
  const { data: savedFilters } = useQuery({
    queryKey: savedFilterKeys.all(activeWorkspaceId, null),
    queryFn: () => savedFiltersApi.list(activeWorkspaceId, null),
    enabled: !!activeWorkspaceId,
  });

  const saveFilterMutation = useMutation({
    mutationFn: (payload) => savedFiltersApi.create(activeWorkspaceId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedFilterKeys.all(activeWorkspaceId, null) }),
  });

  const deleteFilterMutation = useMutation({
    mutationFn: (id) => savedFiltersApi.delete(activeWorkspaceId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedFilterKeys.all(activeWorkspaceId, null) }),
  });

  const bulkMutation = useMutation({
    mutationFn: (payload) => tasksApi.bulk(activeWorkspaceId, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: taskKeys.all(activeWorkspaceId) });
      setSelectedIds(new Set());
      if (res.data?.failed?.length > 0) {
        setBulkError(`${res.data.failed.length} task(s) failed: ${res.data.failed.map((f) => f.error).join(', ')}`);
      }
    },
    onError: (e) => setBulkError(extractError(e)),
  });

  // Handlers
  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(tasks.map((t) => t._id)));
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilters([]);
    setPriorityFilters([]);
    setOverdueOnly(false);
    setSortField('createdAt');
    setSortDir('desc');
  };

  const hasActiveFilters = search || statusFilters.length || priorityFilters.length || overdueOnly;

  const applyBulkAction = (action, value) => {
    if (action === 'delete') {
      setConfirmBulk({ action, value });
      return;
    }
    setBulkError('');
    bulkMutation.mutate({ taskIds: [...selectedIds], action, value });
  };

  const applySavedFilter = (sf) => {
    setSearch(sf.filters?.search || '');
    setStatusFilters(sf.filters?.status || []);
    setPriorityFilters(sf.filters?.priority || []);
    setOverdueOnly(sf.filters?.overdue || false);
    setSortField(sf.sortField || 'createdAt');
    setSortDir(sf.sortDir || 'desc');
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-surface-400 ml-1" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-primary-600 ml-1" /> : <ChevronDown size={12} className="text-primary-600 ml-1" />;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900">List View</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            {total > 0 ? `${total} task${total === 1 ? '' : 's'}` : 'No tasks'}
            {isFetching && !isLoading && <span className="ml-2 text-primary-500">Refreshing…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary btn-sm flex items-center gap-1.5"
            onClick={() => setSaveDialogOpen(true)}
            title="Save current view"
          >
            <Bookmark size={13} /> Save View
          </button>
          <button className="btn-primary btn-sm flex items-center gap-1.5">
            <Plus size={13} /> New Task
          </button>
        </div>
      </div>

      {/* Saved Filters */}
      {savedFilters?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-surface-400 font-medium">Saved:</span>
          {savedFilters.map((sf) => (
            <div key={sf._id} className="group flex items-center gap-1 bg-white border border-surface-200 rounded-full px-3 py-1">
              <button className="text-xs text-surface-700 hover:text-primary-600" onClick={() => applySavedFilter(sf)}>
                {sf.name}
              </button>
              <button
                className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-red-500"
                onClick={() => deleteFilterMutation.mutate(sf._id)}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="text-surface-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="bg-transparent outline-none text-sm text-surface-700 placeholder:text-surface-400 w-full"
          />
          {search && <button onClick={() => setSearch('')}><X size={13} className="text-surface-400" /></button>}
        </div>

        <button
          onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          className={`btn-sm flex items-center gap-1.5 ${hasActiveFilters ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Filter size={13} />
          Filters
          {hasActiveFilters && (
            <span className="bg-white text-primary-700 text-[10px] font-bold rounded-full px-1.5">
              {[statusFilters.length, priorityFilters.length, overdueOnly ? 1 : 0].reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>

        {/* Sort selector */}
        <select
          value={`${sortField}_${sortDir}`}
          onChange={(e) => {
            const [f, d] = e.target.value.split('_');
            setSortField(f);
            setSortDir(d);
          }}
          className="input w-auto text-xs"
        >
          {SORT_FIELDS.flatMap((f) => [
            <option key={`${f.value}_desc`} value={`${f.value}_desc`}>{f.label} ↓</option>,
            <option key={`${f.value}_asc`} value={`${f.value}_asc`}>{f.label} ↑</option>,
          ])}
        </select>

        {hasActiveFilters && (
          <button className="btn-ghost btn-sm text-surface-500 hover:text-red-600" onClick={clearFilters}>
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {/* Filter panel */}
      {filterPanelOpen && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-4 animate-scale-in">
          <div>
            <p className="label">Status</p>
            <div className="space-y-1.5">
              {TASK_STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={statusFilters.includes(s)}
                    onChange={(e) => {
                      if (e.target.checked) setStatusFilters([...statusFilters, s]);
                      else setStatusFilters(statusFilters.filter((x) => x !== s));
                    }}
                    className="rounded"
                  />
                  <StatusBadge status={s} />
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Priority</p>
            <div className="space-y-1.5">
              {TASK_PRIORITIES.map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={priorityFilters.includes(p)}
                    onChange={(e) => {
                      if (e.target.checked) setPriorityFilters([...priorityFilters, p]);
                      else setPriorityFilters(priorityFilters.filter((x) => x !== p));
                    }}
                    className="rounded"
                  />
                  <PriorityBadge priority={p} />
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Due Date</p>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="rounded" />
              <span className="text-sm text-surface-700">Overdue only</span>
            </label>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {bulkError && <Alert type="error" message={bulkError} dismissible onDismiss={() => setBulkError('')} />}
      <BulkActionBar
        selectedIds={[...selectedIds]}
        onClear={() => setSelectedIds(new Set())}
        onAction={applyBulkAction}
      />

      {/* Table */}
      {isLoading ? (
        <PageLoader />
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 card">
          <ListFilter size={48} className="text-surface-200 mx-auto mb-4" />
          <h2 className="text-base font-semibold text-surface-700 mb-1">No tasks found</h2>
          <p className="text-sm text-surface-400">
            {hasActiveFilters ? 'Try clearing some filters.' : 'No tasks in this workspace yet.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50">
                  <th className="px-4 py-3 text-left w-8">
                    <button onClick={toggleSelectAll}>
                      {selectedIds.size === tasks.length && tasks.length > 0
                        ? <CheckSquare size={14} className="text-primary-600" />
                        : <Square size={14} className="text-surface-400" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-surface-500 cursor-pointer hover:text-surface-800" onClick={() => handleSort('title')}>
                    <span className="flex items-center">Task <SortIcon field="title" /></span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-surface-500 cursor-pointer hover:text-surface-800" onClick={() => handleSort('status')}>
                    <span className="flex items-center">Status <SortIcon field="status" /></span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-surface-500 cursor-pointer hover:text-surface-800" onClick={() => handleSort('priority')}>
                    <span className="flex items-center">Priority <SortIcon field="priority" /></span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-surface-500">Assignee</th>
                  <th className="px-4 py-3 text-left font-medium text-surface-500">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-surface-500 cursor-pointer hover:text-surface-800" onClick={() => handleSort('dueDate')}>
                    <span className="flex items-center">Due <SortIcon field="dueDate" /></span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-surface-500">Labels</th>
                  <th className="px-4 py-3 text-left font-medium text-surface-500 cursor-pointer hover:text-surface-800" onClick={() => handleSort('updatedAt')}>
                    <span className="flex items-center">Updated <SortIcon field="updatedAt" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {tasks.map((task) => {
                  const overdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';
                  const isSelected = selectedIds.has(task._id);
                  return (
                    <tr key={task._id} className={`hover:bg-surface-50 transition-colors ${isSelected ? 'bg-primary-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(task._id)}>
                          {isSelected
                            ? <CheckSquare size={14} className="text-primary-600" />
                            : <Square size={14} className="text-surface-300" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-surface-900 truncate">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-surface-400 truncate mt-0.5">{task.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                      <td className="px-4 py-3">
                        {task.assignee
                          ? <div className="flex items-center gap-1.5"><Avatar user={task.assignee} size="xs" /><span className="text-xs text-surface-600 truncate max-w-[80px]">{task.assignee.name}</span></div>
                          : <span className="text-xs text-surface-300">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-surface-600">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.project?.color || '#6366f1' }} />
                          <span className="truncate max-w-[100px]">{task.project?.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {task.dueDate ? (
                          <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : 'text-surface-500'}`}>
                            <Calendar size={11} />
                            {isToday(new Date(task.dueDate)) ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
                          </span>
                        ) : <span className="text-xs text-surface-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {task.labels?.slice(0, 2).map((l) => <LabelBadge key={l} label={l} />)}
                          {task.labels?.length > 2 && <span className="text-xs text-surface-400">+{task.labels.length - 2}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-400">
                        {format(new Date(task.updatedAt), 'MMM d')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100 bg-surface-50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-surface-500">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="input py-1 text-xs w-auto"
              >
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-surface-500">
                {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
              </span>
              <button
                className="btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >← Prev</button>
              <button
                className="btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >Next →</button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <SaveFilterDialog
        isOpen={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={(payload) => saveFilterMutation.mutate(payload)}
        currentFilters={{ search: debouncedSearch, status: statusFilters, priority: priorityFilters, overdue: overdueOnly }}
        currentSort={{ field: sortField, dir: sortDir }}
      />

      <ConfirmDialog
        isOpen={!!confirmBulk}
        onClose={() => setConfirmBulk(null)}
        title="Confirm Delete"
        message={`Permanently delete ${selectedIds.size} selected task(s)? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          bulkMutation.mutate({ taskIds: [...selectedIds], action: 'delete', value: null });
          setConfirmBulk(null);
        }}
      />
    </div>
  );
};
