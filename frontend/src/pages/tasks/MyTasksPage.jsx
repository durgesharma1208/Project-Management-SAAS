import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Filter, CheckSquare, Calendar, Flag } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import api from '../../lib/api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { PageLoader } from '../../components/ui/Spinner';
import { PriorityBadge, StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Dialog } from '../../components/ui/Dialog';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { useAuth } from '../../contexts/AuthContext';
import { useForm } from 'react-hook-form';

export const MyTasksPage = () => {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks', activeWorkspaceId, search, statusFilter],
    queryFn: () => api.get(`/workspaces/${activeWorkspaceId}/tasks`, {
      params: {
        myTasks: 'true',
        search: search || undefined,
        status: statusFilter || undefined,
      }
    }).then(r => r.data.data.tasks),
    enabled: !!activeWorkspaceId,
  });

  const tasks = data || [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-surface-900">My Tasks</h1>
          <p className="text-sm text-surface-500 mt-0.5">Tasks assigned to you</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-lg px-3 py-2 w-56">
          <Search size={13} className="text-surface-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…" className="bg-transparent outline-none text-sm text-surface-700 placeholder:text-surface-400 w-full" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="">All statuses</option>
          <option value="backlog">Backlog</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="done">Done</option>
        </select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : tasks.length === 0 ? (
        <div className="text-center py-20">
          <CheckSquare size={48} className="text-surface-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-surface-700 mb-2">
            {search || statusFilter ? 'No matching tasks' : 'No tasks assigned to you'}
          </h2>
          <p className="text-sm text-surface-400">
            {search || statusFilter ? 'Try different filters' : 'Tasks assigned to you will appear here'}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-surface-100">
          {tasks.map(task => {
            const overdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';
            return (
              <div key={task._id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors">
                <StatusBadge status={task.status} showLabel={false} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-surface-400">{task.project?.name}</span>
                  </div>
                </div>
                <PriorityBadge priority={task.priority} showLabel={false} />
                {task.dueDate && (
                  <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : 'text-surface-400'}`}>
                    <Calendar size={11} />
                    {isToday(new Date(task.dueDate)) ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
