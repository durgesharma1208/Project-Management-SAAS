/* Mock of src/lib/api.js used only by the offline render smoke test. */
const now = new Date();
const iso = (days) => new Date(now.getTime() + days * 86400000).toISOString();

const user1 = { _id: 'u1', name: 'Ava Sharma', email: 'ava@example.com', jobTitle: 'Product Manager', avatar: null, createdAt: iso(-90) };
const user2 = { _id: 'u2', name: 'Ravi Mehta', email: 'ravi@example.com', jobTitle: 'Engineer', avatar: null, createdAt: iso(-60) };

const statuses = [
  { id: 'backlog', name: 'Backlog', color: '#94a3b8', category: 'not_started', position: 0 },
  { id: 'todo', name: 'To Do', color: '#3b82f6', category: 'not_started', position: 1 },
  { id: 'in_progress', name: 'In Progress', color: '#f59e0b', category: 'active', position: 2 },
  { id: 'in_review', name: 'In Review', color: '#8b5cf6', category: 'active', position: 3 },
  { id: 'done', name: 'Done', color: '#10b981', category: 'completed', position: 4 },
];

const workflow = {
  _id: 'wf1',
  name: 'Standard delivery',
  description: 'Default lifecycle',
  statuses,
  transitions: [
    { from: 'backlog', to: 'todo' }, { from: 'todo', to: 'in_progress' },
    { from: 'in_progress', to: 'in_review' }, { from: 'in_review', to: 'done' },
  ],
  isDefault: true,
  isTemplate: false,
};

const project1 = {
  _id: 'p1', name: 'TaskFlow v1.0 Launch', description: 'Ship the first release', emoji: '🚀',
  color: '#6366f1', status: 'active', priority: 'high', isArchived: false,
  owner: user1, members: [user1, user2], team: null,
  startDate: iso(-20), dueDate: iso(20), createdAt: iso(-40), updatedAt: iso(-1),
  progress: 42, totalTasks: 12, completedTasks: 5, taskCounts: { done: 5, in_progress: 3 },
};
const project2 = {
  _id: 'p2', name: 'Mobile App', description: 'iOS + Android', emoji: '📱',
  color: '#8b5cf6', status: 'planned', priority: 'medium', isArchived: false,
  owner: user1, members: [user1], team: null,
  startDate: iso(-5), dueDate: iso(45), createdAt: iso(-20), updatedAt: iso(-2),
  progress: 0, totalTasks: 3, completedTasks: 0, taskCounts: { todo: 3 },
};

const mkTask = (id, title, status, priority, extra = {}) => ({
  _id: id, title, description: 'Short description for ' + title,
  status, priority, labels: ['frontend'], position: 0,
  startDate: iso(-6), dueDate: iso(3), estimatedHours: 4, durationDays: 3,
  subtasks: [
    { _id: id + 's1', title: 'Draft approach', isCompleted: true },
    { _id: id + 's2', title: 'Implement', isCompleted: false },
  ],
  assignee: user1, creator: user1, project: { _id: 'p1', name: project1.name, color: project1.color, emoji: project1.emoji },
  createdAt: iso(-8), updatedAt: iso(-1),
  ...extra,
});

const tasks = [
  mkTask('t1', 'Design the navigation shell', 'in_progress', 'high', { dueDate: iso(-2) }),
  mkTask('t2', 'Build the task drawer', 'todo', 'urgent', { dueDate: iso(0) }),
  mkTask('t3', 'Wire dashboard aggregates', 'done', 'medium'),
  mkTask('t4', 'Polish empty states', 'in_review', 'low', { assignee: user2 }),
  mkTask('t5', 'Add calendar view', 'backlog', 'none', { assignee: null }),
  mkTask('t6', 'Kanban drag and drop', 'in_progress', 'high', { assignee: user2 }),
];

const activity = [
  { _id: 'a1', actor: user1, type: 'task.created', summary: 'created "Design the navigation shell"', createdAt: iso(-0.2), project: { name: project1.name, color: project1.color, emoji: '🚀' } },
  { _id: 'a2', actor: user2, type: 'task.status_changed', summary: 'moved a task to Done', createdAt: iso(-1), project: { name: project1.name } },
];

const routes = [
  [/^\/auth\/me$/, () => ({ user: user1 })],
  [/^\/auth\/login$/, () => ({ user: user1, accessToken: 'token' })],
  [/^\/auth\/register$/, () => ({ user: user1, accessToken: 'token' })],
  [/^\/auth\/logout$/, () => ({})],
  [/^\/auth\/forgot-password$/, () => ({ message: 'ok' })],
  [/^\/auth\/reset-password$/, () => ({ message: 'ok' })],
  [/^\/users\/profile$/, () => ({ user: user1 })],
  [/^\/users\/change-password$/, () => ({})],
  [/^\/workspaces$/, () => ({ workspaces: [{ ...project1, role: 'owner', _id: 'w1', name: 'Acme Corp', slug: 'acme', createdAt: iso(-100), color: '#6366f1' }] })],
  [/^\/workspaces\/[^/]+$/, () => ({ workspace: { _id: 'w1', name: 'Acme Corp', role: 'owner', color: '#6366f1' } })],
  [/^\/workspaces\/[^/]+\/members/, () => ({ members: [{ _id: 'm1', role: 'owner', user: user1 }, { _id: 'm2', role: 'member', user: user2 }] })],
  [/^\/workspaces\/[^/]+\/invitations/, () => ({ invitations: [{ _id: 'i1', email: 'new@example.com', role: 'member', expiresAt: iso(5), inviteUrl: 'http://localhost:5173/invite/abc' }], invitation: { _id: 'i1', email: 'new@example.com', inviteUrl: 'http://localhost:5173/invite/abc' } })],
  [/^\/workspaces\/[^/]+\/activity/, () => ({ activities: activity })],
  [/^\/workspaces\/[^/]+\/teams/, () => ({ teams: [{ _id: 'team1', name: 'Engineering', emoji: '⚙️', description: 'Core product', members: [{ _id: 'tm1', role: 'lead', user: user1 }] }], team: { _id: 'team1', name: 'Engineering', emoji: '⚙️', members: [{ _id: 'tm1', role: 'lead', user: user1 }] } })],
  [/^\/workspaces\/[^/]+\/saved-filters/, () => ({ filters: [{ _id: 'sf1', name: 'Due this week', filters: { status: ['todo', 'in_progress'] }, sortField: 'dueDate', sortDir: 'asc' }], filter: { _id: 'sf1', name: 'Saved', filters: {} } })],
  [/^\/workspaces\/[^/]+\/workflows/, () => ({ workflows: [workflow], workflow, seeded: 1, templates: [workflow] })],
  [/^\/workspaces\/[^/]+\/tasks\/dashboard/, () => ({
    counts: {
      totalTasks: 12, completedTasks: 5, openTasks: 7, inProgressTasks: 3, overdueTasks: 1,
      dueTodayTasks: 1, unassignedTasks: 2, projectCount: 2, activeProjectCount: 1,
      myOpenTasks: 4, completedThisWeek: 3, completedPrevWeek: 2,
    },
    statusSummary: [{ _id: 'todo', count: 3 }, { _id: 'in_progress', count: 3 }, { _id: 'done', count: 5 }, { _id: 'backlog', count: 1 }],
    prioritySummary: [{ _id: 'high', count: 2 }, { _id: 'urgent', count: 1 }],
    myTasks: tasks.slice(0, 4), dueSoon: tasks.slice(0, 2), overdueTasks: [tasks[0]],
    recentActivity: activity, projects: [project1, project2],
  })],
  [/^\/workspaces\/[^/]+\/tasks\/calendar/, () => ({ tasks })],
  [/^\/workspaces\/[^/]+\/tasks\/bulk/, () => ({ updated: 2 })],
  [/^\/workspaces\/[^/]+\/tasks\/[^/]+\/comments/, () => ({ comments: [{ _id: 'c1', content: 'Looks good', author: user1, createdAt: iso(-1), isEdited: false }], comment: { _id: 'c1', content: 'Looks good', author: user1, createdAt: iso(-1) } })],
  [/^\/workspaces\/[^/]+\/tasks\/[^/]+\/subtasks/, () => ({ task: tasks[0] })],
  [/^\/workspaces\/[^/]+\/tasks\/[^/]+\/activity/, () => ({ activities: activity })],
  [/^\/workspaces\/[^/]+\/tasks\/[^/]+\/dependencies/, () => ({ dependencies: [], blockedBy: [], blocking: [] })],
  [/^\/workspaces\/[^/]+\/tasks\/[^/]+$/, () => ({ task: tasks[0] })],
  [/^\/workspaces\/[^/]+\/tasks/, () => ({ tasks, total: tasks.length, page: 1, limit: 50, totalPages: 1, sort: 'manual', dir: 'desc' })],
  [/^\/workspaces\/[^/]+\/projects\/[^/]+\/dependency-graph/, () => ({
    nodes: tasks.map((t) => ({ id: t._id, title: t.title, status: t.status, isBlocked: t.status === 'todo' })),
    edges: [{ id: 'e1', predecessor: 't1', successor: 't2' }],
  })],
  [/^\/workspaces\/[^/]+\/projects\/[^/]+\/critical-path/, () => ({
    totalDuration: 9, projectFinish: 9, error: null, warnings: [], excludedTaskCount: 0, totalTaskCount: 2,
    criticalPaths: [['t1', 't2']], criticalTaskIds: ['t1', 't2'],
    results: [
      { taskId: 't1', title: tasks[0].title, status: 'in_progress', durationDays: 3, es: 0, ef: 3, ls: 0, lf: 3, slack: 0, isCritical: true },
      { taskId: 't2', title: tasks[1].title, status: 'todo', durationDays: 6, es: 3, ef: 9, ls: 3, lf: 9, slack: 0, isCritical: true },
    ],
  })],
  [/^\/workspaces\/[^/]+\/projects\/[^/]+\/workflow/, () => ({ workflow })],
  [/^\/workspaces\/[^/]+\/projects\/[^/]+\/activity/, () => ({ activities: activity })],
  [/^\/workspaces\/[^/]+\/projects\/[^/]+\/archive/, () => ({ project: { ...project1, isArchived: true } })],
  [/^\/workspaces\/[^/]+\/projects\/[^/]+\/restore/, () => ({ project: project1 })],
  [/^\/workspaces\/[^/]+\/projects\/[^/]+$/, () => ({
    project: project1, taskCounts: { done: 5, in_progress: 3 }, overdueTasks: 1,
    workload: [{ _id: 'u1', count: 4, name: user1.name, avatar: null }],
  })],
  [/^\/workspaces\/[^/]+\/projects/, () => ({ projects: [project1, project2], project: project1 })],
  [/^\/workspaces\/invitations\/[^/]+$/, () => ({ invitation: { _id: 'i1', role: 'member', workspace: { name: 'Acme Corp', color: '#6366f1' }, invitedBy: user1, expiresAt: iso(5) } })],
];

const find = (url) => {
  for (const [re, build] of routes) if (re.test(url)) return build;
  return null;
};

const respond = (url) => {
  const build = find(url);
  if (!build) {
    // Unknown endpoint: return an empty success payload so the UI shows empty states.
    return Promise.resolve({ data: { success: true, data: {} } });
  }
  return Promise.resolve({ data: { success: true, data: build() } });
};

const api = {
  get: (url) => respond(url),
  post: (url, body) => respond(url, body),
  patch: (url, body) => respond(url, body),
  put: (url, body) => respond(url, body),
  delete: (url) => respond(url),
  interceptors: { request: { use: () => {} }, response: { use: () => {} } },
  defaults: { headers: {} },
};

export const API_BASE_URL = '/api';
export default api;
