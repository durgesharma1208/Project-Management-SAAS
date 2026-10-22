/**
 * Underline tabs with keyboard support (arrow left/right).
 * tabs: [{ id, label, icon?, count? }]
 */
export const Tabs = ({ tabs, value, onChange, className = '' }) => {
  const handleKeyDown = (event) => {
    const index = tabs.findIndex((t) => t.id === value);
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = event.key === 'ArrowRight'
      ? (index + 1) % tabs.length
      : (index - 1 + tabs.length) % tabs.length;
    onChange(tabs[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label="Sections"
      onKeyDown={handleKeyDown}
      className={`flex items-center gap-1 border-b border-surface-200 overflow-x-auto scrollbar-none ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors
              ${active
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-surface-500 hover:text-surface-800'}`}
          >
            {Icon && <Icon size={14} />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`badge ${active ? 'bg-primary-50 text-primary-700' : 'bg-surface-100 text-surface-500'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
