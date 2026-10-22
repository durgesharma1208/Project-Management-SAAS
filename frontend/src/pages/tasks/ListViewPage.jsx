import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, ArrowUp, Bookmark, CheckSquare2, ChevronLeft, ChevronRight, Filter,
  ListFilter, Plus, Search, SlidersHorizontal, Square, Trash2, X,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useMembers } from '../../hooks/useMembers';
import { useToast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';
import { LabelBadge, PriorityBadge, StatusBadge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/ui/Primitives';
import { PageHeader } from '../../components/ui/Primitives';
import { Dialog } from '../../components/ui/Dialog';
import { FormField, Input } from '../../components/ui/Form';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TaskFormDialog } from '../../components/tasks/TaskFormDialog';
import { TaskPanel } from '../../components/tasks/TaskPanel';
import {
  tasksApi, savedFiltersApi, taskKeys, savedFilterKeys, dashboardKeys, projectKeys,
} from '../../lib/taskApi';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../lib/constants';
import { dueLabel, isOverdue } from '../../lib/format';
import { extractError } from '../../components/ui/Alert';

const PAGE_SIZES = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'manual', label: 'Board order' },
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'createdAt', label: 'Newest first' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'title', label: 'Title' },
];

const useDebounced = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

const SaveViewDialog = ({ isOpen, onClose, onSave, isSaving }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (isOpen) { setName(''); setError(''); } }, [isOpen]);

  const submit = () => {
    if (!name.trim()) { setError('Give this view a name'); return; }
    onSave(name.trim());
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Save current view"
      description="Saved views keep your filters and sorting for one click later."
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={isSaving}>Save view</button>
        </>
      }
    >
      <FormField label="View name" error={error} required id="view-name">
        <Input
          id="view-name"
          value={name}
          onChange={(event) => { setName(event.target.value); setError(''); }}
          onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
          placeholder="e.g. High priority bugs"
          autoFocus
        />
      </FormField>
    </Dialog>
  );
};

export const ListViewPage = () => {
  const { activeWorkspaceId } = useWorkspace();
  const { users } = useMembers();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounced(search);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [assignee, setAssignee] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sort, setSort] = useState('manual');
  const [dir, setDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(searchParams.get('new') === '1');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const openTaskId = searchParams.get('task') || null;
  const setOpenTaskId = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('task', id);
    else next.delete('task');
    setSearchParams(next, { replace: true });
  };

  const params = useMemo(() => ({
    search: debouncedSearch || undefined,
    status: statuses.length ? statuses.join(',') : undefined,
    priority: priorities.length ? priorities.join(',') : undefined,
    assignee: assignee || undefined,
    overdue: overdueOnly ? 'true' : undefined,
    sort,
    dir,
    page,
    limit: pageSize,
  }), [debouncedSearch, statuses, priorities, assignee, overdueOnly, sort, dir, page, pageSize]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: taskKeys.list(activeWorkspaceId, params),
    queryFn: () => tasksApi.list(activeWorkspaceId, params),
    enabled: Boolean(activeWorkspaceId),
  });

  const tasks = data?.tasks || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const { data: savedViews = [] } = useQuery({
    queryKey: savedFilterKeys.all(activeWorkspaceId, null),
    queryFn: () => savedFiltersApi.list(activeWorkspaceId, null),
    enabled: Boolean(activeWorkspaceId),
  });

  const saveViewMutation = useMutation({
    mutationFn: (name) => savedFiltersApi.create(activeWorkspaceId, {
      name,
      filters: {
        search: debouncedSearch || undefined,
        status: statuses.length ? statuses : undefined,
        priority: priorities.length ? priorities : undefined,
        assignee: assignee ? [assignee] : undefined,
        overdue: overdueOnly || undefined,
      },
      sortField: sort === 'manual' ? 'createdAt' : sort,
      sortDir: dir,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedFilterKeys.all(activeWorkspaceId, null) });
      toast.success('View saved');
      setSaveViewOpen(false);
    },
    onError: (error) => toast.error(extractError(error)),
  });

  const deleteViewMutation = useMutation({
    mutationFn: (id) => savedFiltersApi.remove(activeWorkspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedFilterKeys.all(activeWorkspaceId, null) });
      toast.success('Saved view removed');
    },
    onError: (error) => toast.error(extractError(error)),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, value }) => tasksApi.bulk(activeWorkspaceId, {
      taskIds: selectedIds,
      action,
      value,
    }),
    onSuccess: (result) => {
      const failed = result?.data?.failed || [];
      if (failed.length) toast.error(`${failed.length} task(s) could not be updated: ${failed[0].error}`);
      else toast.success(`${selectedIds.length} task(s) updated`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: taskKeys.all(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all(activeWorkspaceId) });
    },
    onError: (error) => toast.error(extractError(error)),
  });

  const activeFilterCount = statuses.length + priorities.length + (assignee ? 1 : 0) + (overdueOnly ? 1 : 0);

  const resetFilters = () => {
    setStatuses([]);
    setPriorities([]);
    setAssignee('');
    setOverdueOnly(false);
    setPage(1);
  };

  const applySavedView = (view) => {
    setSearch(view.filters?.search || '');
    setStatuses(view.filters?.status || []);
    setPriorities(view.filters?.priority || []);
    setAssignee(view.filters?.assignee?.[0] || '');
    setOverdueOnly(Boolean(view.filters?.overdue));
    setSort(view.sortField === 'createdAt' ? 'createdAt' : view.sortField || 'manual');
    setDir(view.sortDir || 'desc');
    setPage(1);
  };

  const toggleInArray = (list, setList, value) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
    setPage(1);
  };

  const allSelected = tasks.length > 0 && selectedIds.length === tasks.length;

  return (
    <div className="page">
      <PageHeader
        title="All Tasks"
        description={`${total} ${total === 1 ? 'task' : 'tasks'} in this workspace${isFetching && !isLoading ? ' · refreshing…' : ''}`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setSaveViewOpen(true)} disabled={!activeWorkspaceId}>
              <Bookmark size={14} /> Save view
            </button>
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New task
            </button>
          </>
        }
      />

      {/* Saved views */}
      {savedViews.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-2xs font-semibold uppercase tracking-wider text-surface-400 mr-1">Saved views</span>
          {savedViews.map((view) => (
            <div key={view._id} className="group inline-flex items-center bg-white border border-surface-200 rounded-full pl-2.5 pr-1 py-0.5">
              <button type="button" className="text-xs text-surface-600 hover:text-primary-700" onClick={() => applySavedView(view)}>
                {view.name}
              </button>
              <button
                type="button"
                onClick={() => deleteViewMutation.mutate(view._id)}
                className="ml-1 p-0.5 rounded-full text-surface-300 hover:text-red-500 hover:bg-red-50"
                aria-label={`Delete saved view ${view.name}`}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="card p-2.5 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search tasks by title, description or label…"
              className="input pl-8"
              aria-label="Search tasks"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
            className={activeFilterCount ? 'btn-secondary border-primary-300 text-primary-700' : 'btn-secondary'}
          >
            <Filter size={14} /> Filters
            {activeFilterCount > 0 && (
              <span className="badge bg-primary-600 text-white">{activeFilterCount}</span>
            )}
          </button>

          <div className="flex items-center gap-1">
            <SlidersHorizontal size={13} className="text-surface-400" />
            <select
              value={sort}
              onChange={(event) => { setSort(event.target.value); setPage(1); }}
              className="input input-sm w-auto"
              aria-label="Sort tasks"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}
              className="btn-icon border border-surface-200"
              aria-label={dir === 'asc' ? 'Sort ascending' : 'Sort descending'}
            >
              {dir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>

          {(activeFilterCount > 0 || search) && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => { resetFilters(); setSearch(''); }}>
              <X size={12} /> Clear all
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-surface-100 animate-fade-in">
            <div>
              <p className="label">Status</p>
              <div className="space-y-1">
                {TASK_STATUSES.map((status) => (
                  <label key={status.id} className="flex items-center gap-2 cursor-pointer text-xs text-surface-600">
                    <input
                      type="checkbox"
                      checked={statuses.includes(status.id)}
                      onChange={() => toggleInArray(statuses, setStatuses, status.id)}
                    />
                    <StatusBadge status={status.id} />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="label">Priority</p>
              <div className="space-y-1">
                {TASK_PRIORITIES.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 cursor-pointer text-xs text-surface-600">
                    <input
                      type="checkbox"
                      checked={priorities.includes(option.id)}
                      onChange={() => toggleInArray(priorities, setPriorities, option.id)}
                    />
                    <PriorityBadge priority={option.id} />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="label">Assignee</p>
              <select
                value={assignee}
                onChange={(event) => { setAssignee(event.target.value); setPage(1); }}
                className="input"
                aria-label="Filter by assignee"
              >
                <option value="">Anyone</option>
                <option value="me">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
                {users.map((member) => (
                  <option key={member._id} value={member._id}>{member.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="label">Due date</p>
              <label className="flex items-center gap-2 text-xs text-surface-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overdueOnly}
                  onChange={(event) => { setOverdueOnly(event.target.checked); setPage(1); }}
                />
                Overdue only
              </label>
              <button type="button" className="btn-ghost btn-sm mt-2" onClick={resetFilters}>
                Reset filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-primary-50 border border-primary-200 animate-slide-up">
          <CheckSquare2 size={15} className="text-primary-600" />
          <span className="text-xs font-medium text-primary-800">{selectedIds.length} selected</span>
          <div className="flex-1" />
          <select
            className="input input-sm w-auto"
            value=""
            onChange={(event) => {
              if (event.target.value) bulkMutation.mutate({ action: 'set_status', value: event.target.value });
            }}
            aria-label="Set status for selected tasks"
          >
            <option value="">Set status…</option>
            {TASK_STATUSES.map((status) => (
              <option key={status.id} value={status.id}>{status.label}</option>
            ))}
          </select>
          <select
            className="input input-sm w-auto"
            value=""
            onChange={(event) => {
              if (event.target.value) bulkMutation.mutate({ action: 'set_priority', value: event.target.value });
            }}
            aria-label="Set priority for selected tasks"
          >
            <option value="">Set priority…</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority.id} value={priority.id}>{priority.label}</option>
            ))}
          </select>
          <select
            className="input input-sm w-auto"
            value=""
            onChange={(event) => {
              const value = event.target.value;
              if (value === '__unassigned') bulkMutation.mutate({ action: 'set_assignee', value: null });
              else if (value) bulkMutation.mutate({ action: 'set_assignee', value });
            }}
            aria-label="Assign selected tasks"
          >
            <option value="">Assign to…</option>
            <option value="__unassigned">Unassigned</option>
            {users.map((member) => (
              <option key={member._id} value={member._id}>{member.name}</option>
            ))}
          </select>
          <button type="button" className="btn-danger-ghost btn-sm" onClick={() => setConfirmBulkDelete(true)}>
            <Trash2 size={12} /> Delete
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
            <X size={13} /> Clear
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <PageSkeleton cards={2} />
      ) : isError ? (
        <ErrorState message="Tasks could not be loaded." onRetry={refetch} />
      ) : tasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ListFilter}
            title={activeFilterCount || search ? 'No tasks match these filters' : 'No tasks yet'}
            description={
              activeFilterCount || search
                ? 'Adjust the search or filters to find what you are looking for.'
                : 'Create your first task to start tracking work in this workspace.'
            }
            action={
              activeFilterCount || search ? (
                <button type="button" className="btn-secondary" onClick={() => { resetFilters(); setSearch(''); }}>
                  Clear filters
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
                  <Plus size={14} /> New task
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead>
                <tr className="table-head border-b border-surface-200">
                  <th className="px-3 py-2 w-9">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(allSelected ? [] : tasks.map((task) => task._id))}
                      aria-label={allSelected ? 'Deselect all tasks' : 'Select all tasks'}
                      className="text-surface-400 hover:text-surface-700"
                    >
                      {allSelected ? <CheckSquare2 size={15} className="text-primary-600" /> : <Square size={15} />}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Task</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Priority</th>
                  <th className="px-3 py-2 text-left font-semibold">Assignee</th>
                  <th className="px-3 py-2 text-left font-semibold">Project</th>
                  <th className="px-3 py-2 text-left font-semibold">Due</th>
                  <th className="px-3 py-2 text-left font-semibold">Labels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {tasks.map((task) => {
                  const selected = selectedIds.includes(task._id);
                  const overdue = isOverdue(task.dueDate, task.status);
                  return (
                    <tr
                      key={task._id}
                      className={`hover:bg-surface-50 transition-colors ${selected ? 'bg-primary-50/40' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedIds(selected
                            ? selectedIds.filter((id) => id !== task._id)
                            : [...selectedIds, task._id])}
                          aria-label={selected ? 'Deselect task' : 'Select task'}
                          className="text-surface-400 hover:text-surface-700"
                        >
                          {selected ? <CheckSquare2 size={15} className="text-primary-600" /> : <Square size={15} />}
                        </button>
                      </td>
                      <td className="px-3 py-2 max-w-[320px]">
                        <button type="button" onClick={() => setOpenTaskId(task._id)} className="text-left w-full group">
                          <p className={`font-medium truncate ${task.status === 'done' ? 'text-surface-400 line-through' : 'text-surface-900 group-hover:text-primary-700'}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-2xs text-surface-400 truncate">{task.description}</p>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={task.status} /></td>
                      <td className="px-3 py-2"><PriorityBadge priority={task.priority} /></td>
                      <td className="px-3 py-2">
                        {task.assignee ? (
                          <span className="flex items-center gap-1.5">
                            <Avatar user={task.assignee} size="xs" />
                            <span className="text-xs text-surface-600 truncate max-w-[96px]">{task.assignee.name}</span>
                          </span>
                        ) : (
                          <span className="text-2xs text-surface-300">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5 text-xs text-surface-600">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.project?.color || '#6366f1' }} />
                          <span className="truncate max-w-[120px]">{task.project?.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {task.dueDate ? (
                          <span className={`text-xs whitespace-nowrap ${overdue ? 'text-red-600 font-medium' : 'text-surface-500'}`}>
                            {dueLabel(task.dueDate)}
                          </span>
                        ) : (
                          <span className="text-2xs text-surface-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(task.labels || []).slice(0, 2).map((label) => <LabelBadge key={label} label={label} />)}
                          {(task.labels || []).length > 2 && (
                            <span className="text-2xs text-surface-400">+{task.labels.length - 2}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-surface-200 bg-surface-50">
            <div className="flex items-center gap-2 text-xs text-surface-500">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
                className="input input-sm w-auto"
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <span className="hidden sm:inline">
                {total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} of {total}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xs text-surface-400">Page {page} of {totalPages}</span>
              <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={13} /> Prev
              </button>
              <button type="button" className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <TaskFormDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      {openTaskId && <TaskPanel taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
      <SaveViewDialog
        isOpen={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        isSaving={saveViewMutation.isPending}
        onSave={(name) => saveViewMutation.mutate(name)}
      />
      <ConfirmDialog
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => { bulkMutation.mutate({ action: 'delete', value: null }); setConfirmBulkDelete(false); }}
        title="Delete selected tasks"
        message={`Permanently delete ${selectedIds.length} task(s) and their comments? This cannot be undone.`}
        confirmLabel="Delete tasks"
        danger
      />
    </div>
  );
};

export default ListViewPage;
