import { format, isToday, isTomorrow, isYesterday, isPast, formatDistanceToNowStrict, differenceInCalendarDays } from 'date-fns';

export const parseDate = (value) => (value ? new Date(value) : null);

export const formatDate = (value, pattern = 'MMM d') => {
  const date = parseDate(value);
  return date ? format(date, pattern) : '';
};

export const formatDateTime = (value) => {
  const date = parseDate(value);
  return date ? format(date, 'MMM d, h:mm a') : '';
};

export const relativeTime = (value) => {
  const date = parseDate(value);
  if (!date) return '';
  return `${formatDistanceToNowStrict(date)} ago`;
};

export const isOverdue = (dueDate, status) =>
  Boolean(dueDate) && isPast(new Date(dueDate)) && status !== 'done' && !isToday(new Date(dueDate));

/**
 * Human friendly due-date label: "Today", "Tomorrow", "Overdue 2d", "Mar 14".
 */
export const dueLabel = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  const days = differenceInCalendarDays(date, new Date());
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days <= 7) return `in ${days}d`;
  return format(date, 'MMM d');
};

export const toInputDate = (value) => {
  const date = parseDate(value);
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
};

export const toInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
