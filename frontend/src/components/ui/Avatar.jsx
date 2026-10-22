/**
 * Avatar component — shows image or colored initials fallback.
 * Props: user ({ name, avatar }), size ('xs'|'sm'|'md'|'lg')
 */
const COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-pink-500', 'bg-rose-500',
  'bg-orange-500', 'bg-amber-500', 'bg-teal-500', 'bg-cyan-500',
  'bg-sky-500', 'bg-blue-500', 'bg-lime-500', 'bg-emerald-500',
];

const colorForName = (name = '') => {
  let code = 0;
  for (const ch of name) code += ch.charCodeAt(0);
  return COLORS[code % COLORS.length];
};

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');

const sizeMap = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

export const Avatar = ({ user, size = 'sm', className = '' }) => {
  const name = user?.name || '?';
  const sz = sizeMap[size] || sizeMap.sm;
  const color = colorForName(name);

  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={name}
        className={`rounded-full object-cover flex-shrink-0 ${sz} ${className}`}
      />
    );
  }

  return (
    <span
      className={`rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-white ${sz} ${color} ${className}`}
      title={name}
    >
      {initials(name)}
    </span>
  );
};

export const AvatarGroup = ({ users = [], max = 3, size = 'sm' }) => {
  const visible = users.slice(0, max);
  const rest = users.length - max;
  const sz = sizeMap[size] || sizeMap.sm;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((u, i) => (
        <Avatar key={u?._id || i} user={u} size={size} className="ring-2 ring-white" />
      ))}
      {rest > 0 && (
        <span className={`rounded-full bg-surface-200 text-surface-600 flex items-center justify-center ring-2 ring-white font-medium text-[10px] ${sz}`}>
          +{rest}
        </span>
      )}
    </div>
  );
};

export default Avatar;
