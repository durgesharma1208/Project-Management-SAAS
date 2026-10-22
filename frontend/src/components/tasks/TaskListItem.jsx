import { CalendarDays, Check, MessageSquare, Paperclip } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { PriorityBadge, StatusBadge } from '../ui/Badge';
import { dueLabel, isOverdue } from '../../lib/format';

/**
 * A single task row, shared by the dashboard, My Tasks and project task lists so
 * the same task always looks and behaves the same.
 */
export const TaskListItem = ({
  task,
  onOpen,
  onToggleComplete,
  showProject = false,
  showStatus = true,
  workflowStatuses = [],
  isToggling = false,
}) => {
  const overdue = isOverdue(task.dueDate, task.status);
  const subtaskTotal = task.subtasks?.length || 0;
  const subtaskDone = task.subtasks?.filter((s) => s.isCompleted).length || 0;

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 transition-colors">
      {onToggleComplete && (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onToggleComplete(task); }}
          disabled={isToggling}
          className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center flex-shrink-0 transition-colors
            ${task.status === 'done'
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-surface-300 text-transparent hover:border-primary-400 hover:text-primary-400'}`}
          aria-label={task.status === 'done' ? 'Reopen task' : 'Mark task complete'}
        >
          <Check size={11} strokeWidth={3} />
        </button>
      )}
      {!onToggleComplete && showStatus && (
        <StatusBadge status={task.status} showLabel={false} workflowStatuses={workflowStatuses} />
      )}

      <button
        type="button"
        onClick={() => onOpen?.(task._id)}
        className="flex-1 min-w-0 text-left"
      >
        <p className={`text-[13px] font-medium truncate ${task.status === 'done' ? 'text-surface-400 line-through' : 'text-surface-800'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {showProject && task.project && (
            <span className="flex items-center gap-1 text-2xs text-surface-400">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.project.color || '#6366f1' }} />
              {task.project.name}
            </span>
          )}
          {subtaskTotal > 0 && (
            <span className="flex items-center gap-0.5 text-2xs text-surface-400">
              <Paperclip size={10} /> {subtaskDone}/{subtaskTotal}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-2xs text-surface-400">
              <MessageSquare size={10} /> {task.commentCount}
            </span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-2 flex-shrink-0">
        <PriorityBadge priority={task.priority} showLabel={false} />
        {task.dueDate && (
          <span className={`hidden sm:flex items-center gap-1 text-2xs whitespace-nowrap ${overdue ? 'text-red-600 font-medium' : 'text-surface-400'}`}>
            <CalendarDays size={11} />
            {dueLabel(task.dueDate)}
          </span>
        )}
        {task.assignee ? (
          <Avatar user={task.assignee} size="xs" />
        ) : (
          <span className="w-5 h-5 rounded-full border border-dashed border-surface-300" title="Unassigned" />
        )}
      </div>
    </div>
  );
};

export default TaskListItem;
