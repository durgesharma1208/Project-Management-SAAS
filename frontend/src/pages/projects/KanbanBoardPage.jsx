import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, ArrowLeft, X, Flag, Calendar, User, Tag, Loader2 } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import api from '../../lib/api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { PageLoader, Spinner } from '../../components/ui/Spinner';
import { PriorityBadge, StatusBadge, LabelBadge, STATUS_CONFIG } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Dialog } from '../../components/ui/Dialog';
import { FormField, Input, Textarea, Select } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { useForm } from 'react-hook-form';

const COLUMNS = [
  { id: 'backlog',     label: 'Backlog',      color: '#94a3b8' },
  { id: 'todo',        label: 'To Do',         color: '#3b82f6' },
  { id: 'in_progress', label: 'In Progress',   color: '#f59e0b' },
  { id: 'in_review',   label: 'In Review',     color: '#8b5cf6' },
  { id: 'done',        label: 'Done',          color: '#22c55e' },
];

const TaskCard = ({ task, index, onClick }) => {
  const overdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';
  const dueToday = task.dueDate && isToday(new Date(task.dueDate));

  return (
    <Draggable draggableId={task._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          className={`
            bg-white border rounded-xl p-3.5 cursor-pointer
            transition-all duration-150
            ${snapshot.isDragging
              ? 'shadow-dialog rotate-1 border-primary-300 scale-[1.02]'
              : 'shadow-subtle border-surface-200 hover:shadow-card hover:border-surface-300'
            }
          `}
        >
          {/* Labels */}
          {task.labels?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.labels.slice(0, 2).map(l => <LabelBadge key={l} label={l} />)}
              {task.labels.length > 2 && <span className="badge bg-surface-100 text-surface-500">+{task.labels.length - 2}</span>}
            </div>
          )}

          {/* Title */}
          <p className="text-sm font-medium text-surface-900 leading-snug line-clamp-2 mb-2.5">
            {task.title}
          </p>

          {/* Meta row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <PriorityBadge priority={task.priority} showLabel={false} />
              {task.dueDate && (
                <span className={`text-[10px] flex items-center gap-0.5 ${
                  overdue ? 'text-red-600 font-medium' : dueToday ? 'text-amber-600' : 'text-surface-400'
                }`}>
                  <Calendar size={9} />
                  {isToday(new Date(task.dueDate)) ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
                </span>
              )}
            </div>
            {task.assignee ? (
              <Avatar user={task.assignee} size="xs" />
            ) : (
              <div className="w-5 h-5 rounded-full border border-dashed border-surface-300 flex items-center justify-center">
                <User size={9} className="text-surface-400" />
              </div>
            )}
          </div>

          {/* Subtask progress */}
          {task.subtasks?.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 bg-surface-100 rounded-full h-1">
                <div
                  className="h-1 bg-primary-400 rounded-full"
                  style={{
                    width: `${Math.round((task.subtasks.filter(s => s.isCompleted).length / task.subtasks.length) * 100)}%`
                  }}
                />
              </div>
              <span className="text-[10px] text-surface-400">
                {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length}
              </span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

const AddTaskInline = ({ status, projectId, workspaceId, onCreated }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const create = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await api.post(`/workspaces/${workspaceId}/tasks`, { title: title.trim(), project: projectId, status });
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      setTitle('');
      setOpen(false);
      onCreated?.();
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-700 py-1 px-1 rounded-lg hover:bg-surface-100 transition-colors w-full mt-1"
      >
        <Plus size={12} /> Add task
      </button>
    );
  }

  return (
    <div className="mt-2 bg-white border border-primary-300 rounded-xl p-3 shadow-card">
      <textarea
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); create(); } if (e.key === 'Escape') setOpen(false); }}
        placeholder="Task title…"
        className="w-full text-sm text-surface-900 resize-none outline-none placeholder:text-surface-400"
        rows={2}
        autoFocus
      />
      <div className="flex gap-2 mt-2">
        <button onClick={create} disabled={loading} className="btn-primary btn-sm">
          {loading ? <Spinner size={12} /> : 'Add'}
        </button>
        <button onClick={() => setOpen(false)} className="btn-ghost btn-sm"><X size={12} /></button>
      </div>
    </div>
  );
};

const TaskDetailDrawer = ({ task, workspaceId, onClose, onUpdated }) => {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  const { data: commentsData } = useQuery({
    queryKey: ['comments', task?._id],
    queryFn: () => api.get(`/workspaces/${workspaceId}/tasks/${task._id}/comments`).then(r => r.data.data),
    enabled: !!task,
  });

  const { data: activityData } = useQuery({
    queryKey: ['task-activity', task?._id],
    queryFn: () => api.get(`/workspaces/${workspaceId}/tasks/${task._id}/activity`).then(r => r.data.data),
    enabled: !!task,
  });

  const updateMutation = useMutation({
    mutationFn: (updates) => api.patch(`/workspaces/${workspaceId}/tasks/${task._id}`, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban'] });
      onUpdated?.();
    },
  });

  const commentMutation = useMutation({
    mutationFn: (content) => api.post(`/workspaces/${workspaceId}/tasks/${task._id}/comments`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', task._id] });
      setComment('');
    },
  });

  if (!task) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white border-l border-surface-200 shadow-dialog z-50 flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={15} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <h2 className="text-lg font-semibold text-surface-900">{task.title}</h2>

          {task.description && (
            <p className="text-sm text-surface-600 whitespace-pre-wrap">{task.description}</p>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="label">Status</p>
              <select
                value={task.status}
                onChange={e => updateMutation.mutate({ status: e.target.value })}
                className="input text-xs"
              >
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <p className="label">Priority</p>
              <select
                value={task.priority}
                onChange={e => updateMutation.mutate({ priority: e.target.value })}
                className="input text-xs"
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            {task.dueDate && (
              <div>
                <p className="label">Due date</p>
                <p className="text-surface-800">{format(new Date(task.dueDate), 'MMM d, yyyy')}</p>
              </div>
            )}
            {task.assignee && (
              <div>
                <p className="label">Assignee</p>
                <div className="flex items-center gap-1.5">
                  <Avatar user={task.assignee} size="xs" />
                  <span className="text-surface-800">{task.assignee.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* Labels */}
          {task.labels?.length > 0 && (
            <div>
              <p className="label">Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {task.labels.map(l => <LabelBadge key={l} label={l} />)}
              </div>
            </div>
          )}

          {/* Subtasks */}
          {task.subtasks?.length > 0 && (
            <div>
              <p className="label mb-2">Subtasks ({task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length})</p>
              <div className="space-y-1.5">
                {task.subtasks.map(sub => (
                  <div key={sub._id} className="flex items-center gap-2.5 py-1">
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${sub.isCompleted ? 'bg-primary-500 border-primary-500' : 'border-surface-300'}`}>
                      {sub.isCompleted && <span className="text-white text-[8px]">✓</span>}
                    </div>
                    <span className={`text-sm ${sub.isCompleted ? 'line-through text-surface-400' : 'text-surface-700'}`}>{sub.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity */}
          {activityData?.activities?.length > 0 && (
            <div>
              <p className="label mb-2">Activity</p>
              <div className="space-y-2">
                {activityData.activities.slice(0, 5).map(a => (
                  <div key={a._id} className="flex items-center gap-2 text-xs text-surface-500">
                    <Avatar user={a.actor} size="xs" />
                    <span>{a.summary}</span>
                    <span className="ml-auto text-surface-300">{format(new Date(a.createdAt), 'MMM d')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <p className="label mb-2">Comments</p>
            <div className="space-y-3 mb-3">
              {(commentsData?.comments || []).map(c => (
                <div key={c._id} className="flex items-start gap-2.5">
                  <Avatar user={c.author} size="xs" />
                  <div className="flex-1 bg-surface-50 rounded-xl px-3 py-2">
                    <p className="text-xs font-medium text-surface-800">{c.author?.name}</p>
                    <p className="text-sm text-surface-700 mt-0.5">{c.content}</p>
                    <p className="text-[10px] text-surface-400 mt-1">{format(new Date(c.createdAt), 'MMM d, h:mm a')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add a comment…"
                className="input text-sm resize-none flex-1"
                rows={2}
              />
              <button
                onClick={() => commentMutation.mutate(comment)}
                disabled={!comment.trim() || commentMutation.isPending}
                className="btn-primary btn-sm self-end"
              >
                {commentMutation.isPending ? <Spinner size={12} /> : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const KanbanBoardPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState(null);
  const [movingTaskId, setMovingTaskId] = useState(null);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/workspaces/${activeWorkspaceId}/projects/${projectId}`).then(r => r.data.data),
    enabled: !!activeWorkspaceId,
  });

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['kanban', projectId, filterAssignee, filterPriority],
    queryFn: () => api.get(`/workspaces/${activeWorkspaceId}/tasks`, {
      params: { project: projectId, assignee: filterAssignee || undefined, priority: filterPriority || undefined }
    }).then(r => r.data.data.tasks),
    enabled: !!activeWorkspaceId && !!projectId,
  });

  const moveMutation = useMutation({
    mutationFn: ({ taskId, status }) =>
      api.post(`/workspaces/${activeWorkspaceId}/tasks/${taskId}/move`, { status }),
    onMutate: ({ taskId, status }) => {
      setMovingTaskId(taskId);
      // Optimistic update
      const prev = qc.getQueryData(['kanban', projectId, filterAssignee, filterPriority]);
      qc.setQueryData(['kanban', projectId, filterAssignee, filterPriority], (old) =>
        (old || []).map(t => t._id === taskId ? { ...t, status } : t)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback
      if (ctx?.prev) qc.setQueryData(['kanban', projectId, filterAssignee, filterPriority], ctx.prev);
    },
    onSettled: () => {
      setMovingTaskId(null);
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
    },
  });

  const tasks = tasksData || [];

  const onDragEnd = useCallback((result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    moveMutation.mutate({ taskId: draggableId, status: newStatus });
  }, [moveMutation]);

  const getColumnTasks = (colId) => tasks.filter(t => t.status === colId);

  if (isLoading) return <PageLoader />;

  const project = projectData?.project;

  return (
    <div className="flex flex-col h-full">
      {/* Board header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-surface-200 flex-shrink-0">
        <button onClick={() => navigate(`/projects/${projectId}`)} className="btn-ghost p-1.5 rounded-lg">
          <ArrowLeft size={15} />
        </button>
        <span className="text-lg">{project?.emoji || '📋'}</span>
        <h1 className="text-sm font-semibold text-surface-900">{project?.name || 'Board'}</h1>
        <span className="text-surface-300">·</span>
        <span className="text-sm text-surface-500">Kanban Board</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Filters */}
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="input text-xs w-auto py-1.5"
          >
            <option value="">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto p-5">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 h-full min-h-[500px]" style={{ width: `${COLUMNS.length * 280}px` }}>
            {COLUMNS.map(col => {
              const colTasks = getColumnTasks(col.id);
              return (
                <div key={col.id} className="flex flex-col w-64 flex-shrink-0">
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-1 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-xs font-semibold text-surface-700 uppercase tracking-wide">{col.label}</span>
                    <span className="ml-auto text-xs text-surface-400 bg-surface-100 rounded-full px-2 py-0.5 font-medium">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Droppable column */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`
                          flex-1 rounded-xl p-2 space-y-2.5 transition-colors min-h-[100px]
                          ${snapshot.isDraggingOver ? 'bg-primary-50 border-2 border-dashed border-primary-300' : 'bg-surface-100/50'}
                        `}
                      >
                        {colTasks.map((task, index) => (
                          <div key={task._id} className="relative">
                            {movingTaskId === task._id && (
                              <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center z-10">
                                <Spinner size={16} className="text-primary-500" />
                              </div>
                            )}
                            <TaskCard task={task} index={index} onClick={setSelectedTask} />
                          </div>
                        ))}
                        {provided.placeholder}

                        <AddTaskInline
                          status={col.id}
                          projectId={projectId}
                          workspaceId={activeWorkspaceId}
                        />
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Task detail drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          workspaceId={activeWorkspaceId}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['kanban', projectId] })}
        />
      )}
    </div>
  );
};
