import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Pencil, Trash2, Plus, CalendarClock, User2, Tag, Clock, MessageSquare,
  CheckCircle2, Circle, Activity as ActivityIcon, Send, Paperclip, Flame,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useMembers } from '../../hooks/useMembers';
import { useToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Avatar } from '../ui/Avatar';
import { StatusBadge, PriorityBadge, LabelBadge } from '../ui/Badge';
import { Skeleton } from '../ui/Primitives';
import { Spinner } from '../ui/Spinner';
import { TaskFormDialog } from './TaskFormDialog';
import {
  tasksApi, workflowsApi, taskKeys, projectKeys, dashboardKeys, workflowKeys,
} from '../../lib/taskApi';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../lib/constants';
import { formatDate, formatDateTime, dueLabel, isOverdue, toInputDate, relativeTime } from '../../lib/format';
import { extractError } from '../ui/Alert';

/** Small inline property row used in the panel. */
const PropertyRow = ({ icon: Icon, label, children }) => (
  <div className="grid grid-cols-[104px_1fr] items-center gap-2 min-h-[34px]">
    <span className="flex items-center gap-1.5 text-xs text-surface-500">
      {Icon && <Icon size={13} className="text-surface-400" />}
      {label}
    </span>
    <div className="min-w-0">{children}</div>
  </div>
);

export const TaskPanel = ({ taskId, onClose }) => {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const { users } = useMembers();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comment, setComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [labelInput, setLabelInput] = useState('');

  const { data: task, isLoading, error } = useQuery({
    queryKey: taskKeys.detail(activeWorkspaceId, taskId),
    queryFn: () => tasksApi.get(activeWorkspaceId, taskId),
    enabled: Boolean(activeWorkspaceId && taskId),
  });

  const { data: comments = [] } = useQuery({
    queryKey: taskKeys.comments(activeWorkspaceId, taskId),
    queryFn: () => tasksApi.comments.list(activeWorkspaceId, taskId),
    enabled: Boolean(activeWorkspaceId && taskId),
  });

  const { data: activity = [] } = useQuery({
    queryKey: taskKeys.activity(activeWorkspaceId, taskId),
    queryFn: () => tasksApi.activity(activeWorkspaceId, taskId),
    enabled: Boolean(activeWorkspaceId && taskId),
  });

  const projectId = task?.project?._id;
  const { data: projectWorkflow } = useQuery({
    queryKey: workflowKeys.project(activeWorkspaceId, projectId),
    queryFn: () => workflowsApi.projectWorkflow(activeWorkspaceId, projectId),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  const statusOptions = projectWorkflow?.workflow?.statuses?.length
    ? [...projectWorkflow.workflow.statuses].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((s) => ({ value: s.id, label: s.name }))
    : TASK_STATUSES.map((s) => ({ value: s.id, label: s.label }));

  // Close with Escape
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !editOpen && !confirmDelete) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose, editOpen, confirmDelete]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all(activeWorkspaceId) });
    queryClient.invalidateQueries({ queryKey: projectKeys.all(activeWorkspaceId) });
    queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(activeWorkspaceId) });
  };

  const updateMutation = useMutation({
    mutationFn: (payload) => tasksApi.update(activeWorkspaceId, taskId, payload),
    onSuccess: () => {
      invalidate();
      toast.success('Task updated');
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const subtaskMutation = useMutation({
    mutationFn: ({ action, payload }) => {
      if (action === 'add') return tasksApi.subtasks.add(activeWorkspaceId, taskId, payload);
      if (action === 'toggle') return tasksApi.subtasks.toggle(activeWorkspaceId, taskId, payload);
      return tasksApi.subtasks.remove(activeWorkspaceId, taskId, payload);
    },
    onSuccess: invalidate,
    onError: (err) => toast.error(extractError(err)),
  });

  const commentMutation = useMutation({
    mutationFn: () => tasksApi.comments.create(activeWorkspaceId, taskId, comment.trim()),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(activeWorkspaceId, taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(activeWorkspaceId, taskId) });
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => tasksApi.comments.remove(activeWorkspaceId, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.comments(activeWorkspaceId, taskId) }),
    onError: (err) => toast.error(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.remove(activeWorkspaceId, taskId),
    onSuccess: () => {
      invalidate();
      toast.success('Task deleted');
      setConfirmDelete(false);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const overdue = task ? isOverdue(task.dueDate, task.status) : false;
  const completedSubtasks = task?.subtasks?.filter((s) => s.isCompleted).length || 0;

  const addLabel = () => {
    const value = labelInput.trim();
    if (!value || !task) return;
    const labels = [...new Set([...(task.labels || []), value])];
    updateMutation.mutate({ labels });
    setLabelInput('');
  };

  const removeLabel = (label) => {
    if (!task) return;
    updateMutation.mutate({ labels: (task.labels || []).filter((l) => l !== label) });
  };

  return (
    <>
      <div className="fixed inset-0 bg-surface-950/30 z-40 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <aside
        className="fixed right-0 top-0 h-full w-full sm:max-w-[540px] bg-white border-l border-surface-200
                   shadow-panel z-50 flex flex-col animate-slide-in-right"
        role="dialog"
        aria-modal="true"
        aria-label={task ? `Task: ${task.title}` : 'Task details'}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-surface-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {task?.project && (
              <span className="chip">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.project.color || '#6366f1' }} />
                <span className="truncate max-w-[160px]">{task.project.name}</span>
              </span>
            )}
            {task && <span className="text-2xs text-surface-400">#{task._id.slice(-6)}</span>}
          </div>
          <div className="flex items-center gap-0.5">
            <button type="button" className="btn-icon" onClick={() => setEditOpen(true)} aria-label="Edit task" disabled={!task}>
              <Pencil size={15} />
            </button>
            <button type="button" className="btn-icon text-red-500 hover:bg-red-50" onClick={() => setConfirmDelete(true)} aria-label="Delete task" disabled={!task}>
              <Trash2 size={15} />
            </button>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Close task panel">
              <X size={16} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error || !task ? (
          <div className="p-6 text-sm text-surface-500">
            This task could not be loaded. It may have been deleted.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 pt-5 pb-4 border-b border-surface-100">
              <h2 className="text-[17px] font-semibold text-surface-900 leading-snug break-words">{task.title}</h2>
              {task.description ? (
                <p className="mt-2 text-[13px] text-surface-600 whitespace-pre-wrap leading-relaxed">{task.description}</p>
              ) : (
                <p className="mt-2 text-[13px] text-surface-400">No description yet.</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                {overdue && (
                  <span className="badge bg-red-50 text-red-600">
                    <Flame size={11} /> Overdue
                  </span>
                )}
                <span className="text-2xs text-surface-400 ml-auto">Created {formatDate(task.createdAt, 'MMM d, yyyy')}</span>
              </div>
            </div>

            {/* Properties */}
            <div className="px-5 py-4 border-b border-surface-100 space-y-1">
              <PropertyRow icon={CheckCircle2} label="Status">
                <select
                  value={task.status}
                  onChange={(e) => updateMutation.mutate({ status: e.target.value })}
                  className="input input-sm"
                  aria-label="Task status"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </PropertyRow>

              <PropertyRow icon={Flame} label="Priority">
                <select
                  value={task.priority}
                  onChange={(e) => updateMutation.mutate({ priority: e.target.value })}
                  className="input input-sm"
                  aria-label="Task priority"
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority.id} value={priority.id}>{priority.label}</option>
                  ))}
                </select>
              </PropertyRow>

              <PropertyRow icon={User2} label="Assignee">
                <select
                  value={task.assignee?._id || ''}
                  onChange={(e) => updateMutation.mutate({ assignee: e.target.value || null })}
                  className="input input-sm"
                  aria-label="Task assignee"
                >
                  <option value="">Unassigned</option>
                  {users.map((member) => (
                    <option key={member._id} value={member._id}>{member.name}</option>
                  ))}
                </select>
              </PropertyRow>

              <PropertyRow icon={CalendarClock} label="Due date">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={toInputDate(task.dueDate)}
                    onChange={(e) => updateMutation.mutate({ dueDate: e.target.value || null })}
                    className="input input-sm"
                    aria-label="Due date"
                  />
                  {task.dueDate && (
                    <span className={`text-2xs whitespace-nowrap ${overdue ? 'text-red-600 font-medium' : 'text-surface-400'}`}>
                      {dueLabel(task.dueDate)}
                    </span>
                  )}
                </div>
              </PropertyRow>

              <PropertyRow icon={Clock} label="Start date">
                <input
                  type="date"
                  value={toInputDate(task.startDate)}
                  onChange={(e) => updateMutation.mutate({ startDate: e.target.value || null })}
                  className="input input-sm"
                  aria-label="Start date"
                />
              </PropertyRow>

              <PropertyRow icon={Clock} label="Estimate">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  defaultValue={task.estimatedHours ?? ''}
                  onBlur={(e) => {
                    const value = e.target.value === '' ? null : Number(e.target.value);
                    if (value !== (task.estimatedHours ?? null)) updateMutation.mutate({ estimatedHours: value });
                  }}
                  className="input input-sm w-28"
                  placeholder="Hours"
                  aria-label="Estimated hours"
                />
              </PropertyRow>

              <PropertyRow icon={Tag} label="Labels">
                <div className="flex flex-wrap items-center gap-1">
                  {(task.labels || []).map((label) => (
                    <span key={label} className="group inline-flex items-center gap-1">
                      <LabelBadge label={label} />
                      <button
                        type="button"
                        onClick={() => removeLabel(label)}
                        className="text-surface-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove label ${label}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addLabel(); }
                    }}
                    placeholder="Add label"
                    className="w-24 px-1.5 py-0.5 text-xs border border-dashed border-surface-300 rounded-md focus:outline-none focus:border-primary-400"
                    aria-label="Add label"
                  />
                </div>
              </PropertyRow>
            </div>

            {/* Subtasks */}
            <div className="px-5 py-4 border-b border-surface-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="section-title">
                  Subtasks {task.subtasks?.length > 0 && (
                    <span className="text-surface-400 font-normal">· {completedSubtasks}/{task.subtasks.length}</span>
                  )}
                </h3>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setEditOpen(true)}>
                  <Paperclip size={12} /> Details
                </button>
              </div>

              <div className="space-y-1">
                {(task.subtasks || []).map((subtask) => (
                  <div key={subtask._id} className="group flex items-center gap-2 py-1">
                    <button
                      type="button"
                      onClick={() => subtaskMutation.mutate({ action: 'toggle', payload: subtask._id })}
                      className="text-surface-300 hover:text-primary-600 transition-colors"
                      aria-label={subtask.isCompleted ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                    >
                      {subtask.isCompleted
                        ? <CheckCircle2 size={15} className="text-emerald-500" />
                        : <Circle size={15} />}
                    </button>
                    <span className={`flex-1 text-[13px] ${subtask.isCompleted ? 'line-through text-surface-400' : 'text-surface-700'}`}>
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => subtaskMutation.mutate({ action: 'remove', payload: subtask._id })}
                      className="text-surface-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete subtask"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {task.subtasks?.length === 0 && (
                  <p className="text-xs text-surface-400 py-1">Break this task into smaller steps.</p>
                )}
              </div>

              <form
                className="flex items-center gap-2 mt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSubtask.trim()) return;
                  subtaskMutation.mutate({ action: 'add', payload: { title: newSubtask.trim() } });
                  setNewSubtask('');
                }}
              >
                <input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="Add a subtask…"
                  className="input input-sm"
                  aria-label="New subtask title"
                />
                <button type="submit" className="btn-secondary btn-sm" disabled={!newSubtask.trim() || subtaskMutation.isPending}>
                  {subtaskMutation.isPending ? <Spinner size={12} /> : <Plus size={13} />}
                  Add
                </button>
              </form>
            </div>

            {/* Comments */}
            <div className="px-5 py-4 border-b border-surface-100">
              <h3 className="section-title flex items-center gap-1.5 mb-3">
                <MessageSquare size={13} className="text-surface-400" /> Comments
                {comments.length > 0 && <span className="text-surface-400 font-normal">({comments.length})</span>}
              </h3>

              <div className="space-y-3">
                {comments.length === 0 && (
                  <p className="text-xs text-surface-400">No comments yet — start the conversation.</p>
                )}
                {comments.map((item) => (
                  <div key={item._id} className="flex items-start gap-2">
                    <Avatar user={item.author} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-surface-800">{item.author?.name}</span>
                        <span className="text-2xs text-surface-400">{formatDateTime(item.createdAt)}</span>
                        {item.isEdited && <span className="text-2xs text-surface-400">(edited)</span>}
                        {item.author?._id === user?._id && (
                          <button
                            type="button"
                            onClick={() => deleteCommentMutation.mutate(item._id)}
                            className="ml-auto text-surface-300 hover:text-red-500"
                            aria-label="Delete comment"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                      <p className="text-[13px] text-surface-700 whitespace-pre-wrap mt-0.5">{item.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form
                className="mt-3 flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (comment.trim()) commentMutation.mutate();
                }}
              >
                <Avatar user={user} size="xs" />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment…"
                  rows={2}
                  className="input resize-none flex-1"
                  aria-label="New comment"
                />
                <button type="submit" className="btn-primary btn-sm" disabled={!comment.trim() || commentMutation.isPending}>
                  {commentMutation.isPending ? <Spinner size={12} /> : <Send size={12} />}
                  Post
                </button>
              </form>
            </div>

            {/* Activity */}
            <div className="px-5 py-4">
              <h3 className="section-title flex items-center gap-1.5 mb-3">
                <ActivityIcon size={13} className="text-surface-400" /> Activity
              </h3>
              {activity.length === 0 ? (
                <p className="text-xs text-surface-400">No activity recorded for this task yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {activity.slice(0, 8).map((item) => (
                    <div key={item._id} className="flex items-start gap-2">
                      <Avatar user={item.actor} size="xs" />
                      <p className="text-xs text-surface-600 flex-1">
                        <span className="font-medium text-surface-800">{item.actor?.name?.split(' ')[0]}</span>{' '}
                        {item.summary}
                        <span className="text-surface-400"> · {relativeTime(item.createdAt)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      {task && (
        <TaskFormDialog
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          task={task}
          defaults={{ lockProject: false }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete task"
        message={`“${task?.title || 'This task'}” and its comments will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete task"
        danger
        isPending={deleteMutation.isPending}
      />
    </>
  );
};

export default TaskPanel;
