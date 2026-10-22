/**
 * API resource helpers + react-query keys.
 *
 * Screens never build URLs inline: every request goes through one of these
 * functions, which keeps payload shapes and cache keys consistent.
 */
import api from './api';

const unwrap = (response) => response.data.data;

// ── Query keys ────────────────────────────────────────────────────────────────
export const taskKeys = {
  all: (wid) => ['tasks', wid],
  list: (wid, filters = {}) => ['tasks', wid, 'list', filters],
  detail: (wid, tid) => ['tasks', wid, 'detail', tid],
  calendar: (wid, range = {}) => ['tasks', wid, 'calendar', range],
  activity: (wid, tid) => ['tasks', wid, 'activity', tid],
  comments: (wid, tid) => ['tasks', wid, 'comments', tid],
  dependencies: (wid, tid) => ['tasks', wid, 'dependencies', tid],
};

export const dashboardKeys = {
  workspace: (wid) => ['dashboard', wid],
};

export const projectKeys = {
  all: (wid) => ['projects', wid],
  list: (wid, filters = {}) => ['projects', wid, 'list', filters],
  detail: (wid, pid) => ['projects', wid, 'detail', pid],
  activity: (wid, pid) => ['projects', wid, 'activity', pid],
  graph: (wid, pid) => ['projects', wid, 'graph', pid],
  criticalPath: (wid, pid) => ['projects', wid, 'critical-path', pid],
};

export const workspaceKeys = {
  all: ['workspaces'],
  activity: (wid) => ['workspaces', wid, 'activity'],
  members: (wid) => ['workspaces', wid, 'members'],
  invitations: (wid) => ['workspaces', wid, 'invitations'],
};

export const workflowKeys = {
  all: (wid) => ['workflows', wid],
  project: (wid, pid) => ['workflows', wid, 'project', pid],
};

export const savedFilterKeys = {
  all: (wid, pid) => ['saved-filters', wid, pid ?? 'all'],
};

export const teamKeys = {
  all: (wid) => ['teams', wid],
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (wid, params) => api.get(`/workspaces/${wid}/tasks`, { params }).then(unwrap),
  get: (wid, tid) => api.get(`/workspaces/${wid}/tasks/${tid}`).then(unwrap).then((d) => d.task),
  create: (wid, payload) => api.post(`/workspaces/${wid}/tasks`, payload).then(unwrap).then((d) => d.task),
  update: (wid, tid, payload) => api.patch(`/workspaces/${wid}/tasks/${tid}`, payload).then(unwrap).then((d) => d.task),
  move: (wid, tid, payload) => api.post(`/workspaces/${wid}/tasks/${tid}/move`, payload).then(unwrap).then((d) => d.task),
  remove: (wid, tid) => api.delete(`/workspaces/${wid}/tasks/${tid}`).then((r) => r.data),
  schedule: (wid, tid, payload) => api.patch(`/workspaces/${wid}/tasks/${tid}/schedule`, payload).then(unwrap).then((d) => d.task),
  calendar: (wid, params) => api.get(`/workspaces/${wid}/tasks/calendar`, { params }).then(unwrap),
  bulk: (wid, payload) => api.post(`/workspaces/${wid}/tasks/bulk`, payload).then((r) => r.data),
  dashboard: (wid) => api.get(`/workspaces/${wid}/tasks/dashboard`).then(unwrap),
  activity: (wid, tid) => api.get(`/workspaces/${wid}/tasks/${tid}/activity`).then(unwrap).then((d) => d.activities),

  comments: {
    list: (wid, tid) => api.get(`/workspaces/${wid}/tasks/${tid}/comments`).then(unwrap).then((d) => d.comments),
    create: (wid, tid, content) =>
      api.post(`/workspaces/${wid}/tasks/${tid}/comments`, { content }).then(unwrap).then((d) => d.comment),
    remove: (wid, commentId) => api.delete(`/workspaces/${wid}/tasks/comments/${commentId}`).then((r) => r.data),
  },

  subtasks: {
    add: (wid, tid, payload) =>
      api.post(`/workspaces/${wid}/tasks/${tid}/subtasks`, payload).then(unwrap).then((d) => d.task),
    toggle: (wid, tid, subtaskId) =>
      api.patch(`/workspaces/${wid}/tasks/${tid}/subtasks/${subtaskId}/toggle`).then(unwrap).then((d) => d.task),
    remove: (wid, tid, subtaskId) =>
      api.delete(`/workspaces/${wid}/tasks/${tid}/subtasks/${subtaskId}`).then(unwrap).then((d) => d.task),
  },

  dependencies: {
    list: (wid, tid) => api.get(`/workspaces/${wid}/tasks/${tid}/dependencies`).then(unwrap),
    add: (wid, tid, payload) => api.post(`/workspaces/${wid}/tasks/${tid}/dependencies`, payload).then(unwrap),
    remove: (wid, tid, depId) => api.delete(`/workspaces/${wid}/tasks/${tid}/dependencies/${depId}`).then((r) => r.data),
  },
};

export const dependencyApi = {
  graph: (wid, pid) => api.get(`/workspaces/${wid}/projects/${pid}/dependency-graph`).then(unwrap),
};

export const criticalPathApi = {
  get: (wid, pid) => api.get(`/workspaces/${wid}/projects/${pid}/critical-path`).then(unwrap),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (wid, params) => api.get(`/workspaces/${wid}/projects`, { params }).then(unwrap).then((d) => d.projects),
  get: (wid, pid) => api.get(`/workspaces/${wid}/projects/${pid}`).then(unwrap),
  create: (wid, payload) => api.post(`/workspaces/${wid}/projects`, payload).then(unwrap).then((d) => d.project),
  update: (wid, pid, payload) => api.patch(`/workspaces/${wid}/projects/${pid}`, payload).then(unwrap).then((d) => d.project),
  archive: (wid, pid) => api.post(`/workspaces/${wid}/projects/${pid}/archive`).then(unwrap),
  restore: (wid, pid) => api.post(`/workspaces/${wid}/projects/${pid}/restore`).then(unwrap),
  remove: (wid, pid) => api.delete(`/workspaces/${wid}/projects/${pid}`).then((r) => r.data),
  activity: (wid, pid, params) => api.get(`/workspaces/${wid}/projects/${pid}/activity`, { params }).then(unwrap).then((d) => d.activities),
  workflow: (wid, pid) => api.get(`/workspaces/${wid}/projects/${pid}/workflow`).then(unwrap),
};

// ── Workspaces / members / invitations ────────────────────────────────────────
export const workspacesApi = {
  list: () => api.get('/workspaces').then(unwrap).then((d) => d.workspaces),
  create: (payload) => api.post('/workspaces', payload).then(unwrap).then((d) => d.workspace),
  get: (wid) => api.get(`/workspaces/${wid}`).then(unwrap),
  update: (wid, payload) => api.patch(`/workspaces/${wid}`, payload).then(unwrap).then((d) => d.workspace),
  activity: (wid, params) => api.get(`/workspaces/${wid}/activity`, { params }).then(unwrap).then((d) => d.activities),
  members: (wid) => api.get(`/workspaces/${wid}/members`).then(unwrap).then((d) => d.members),
  updateMemberRole: (wid, memberId, role) =>
    api.patch(`/workspaces/${wid}/members/${memberId}`, { role }).then(unwrap),
  removeMember: (wid, memberId) => api.delete(`/workspaces/${wid}/members/${memberId}`).then((r) => r.data),
  invitations: (wid) => api.get(`/workspaces/${wid}/invitations`).then(unwrap).then((d) => d.invitations),
  invite: (wid, payload) => api.post(`/workspaces/${wid}/invitations`, payload).then(unwrap).then((d) => d.invitation),
  revokeInvitation: (wid, invitationId) => api.delete(`/workspaces/${wid}/invitations/${invitationId}`).then((r) => r.data),
  getInvitation: (token) => api.get(`/workspaces/invitations/${token}`).then(unwrap).then((d) => d.invitation),
  acceptInvitation: (token) => api.post(`/workspaces/invitations/${token}/accept`).then(unwrap),
};

// ── Workflows ─────────────────────────────────────────────────────────────────
export const workflowsApi = {
  list: (wid, params) => api.get(`/workspaces/${wid}/workflows`, { params }).then(unwrap).then((d) => d.workflows),
  get: (wid, id) => api.get(`/workspaces/${wid}/workflows/${id}`).then(unwrap).then((d) => d.workflow),
  create: (wid, payload) => api.post(`/workspaces/${wid}/workflows`, payload).then(unwrap).then((d) => d.workflow),
  update: (wid, id, payload) => api.patch(`/workspaces/${wid}/workflows/${id}`, payload).then(unwrap).then((d) => d.workflow),
  remove: (wid, id) => api.delete(`/workspaces/${wid}/workflows/${id}`).then((r) => r.data),
  seedTemplates: (wid) => api.post(`/workspaces/${wid}/workflows/seed-templates`).then(unwrap),
  projectWorkflow: (wid, pid) => api.get(`/workspaces/${wid}/projects/${pid}/workflow`).then(unwrap),
  createFromTemplate: (wid, templateId, payload) =>
    api.post(`/workspaces/${wid}/workflows/${templateId}/create-from-template`, payload).then(unwrap).then((d) => d.workflow),
};

// ── Saved filters ─────────────────────────────────────────────────────────────
export const savedFiltersApi = {
  list: (wid, pid) =>
    api.get(`/workspaces/${wid}/saved-filters`, { params: pid ? { project: pid } : {} })
      .then(unwrap).then((d) => d.filters),
  create: (wid, payload) => api.post(`/workspaces/${wid}/saved-filters`, payload).then(unwrap).then((d) => d.filter),
  update: (wid, id, payload) => api.patch(`/workspaces/${wid}/saved-filters/${id}`, payload).then(unwrap).then((d) => d.filter),
  remove: (wid, id) => api.delete(`/workspaces/${wid}/saved-filters/${id}`).then((r) => r.data),
};

// ── Teams ─────────────────────────────────────────────────────────────────────
export const teamsApi = {
  list: (wid) => api.get(`/workspaces/${wid}/teams`).then(unwrap).then((d) => d.teams),
  create: (wid, payload) => api.post(`/workspaces/${wid}/teams`, payload).then(unwrap).then((d) => d.team),
  update: (wid, id, payload) => api.patch(`/workspaces/${wid}/teams/${id}`, payload).then(unwrap).then((d) => d.team),
  remove: (wid, id) => api.delete(`/workspaces/${wid}/teams/${id}`).then((r) => r.data),
  addMember: (wid, id, payload) => api.post(`/workspaces/${wid}/teams/${id}/members`, payload).then(unwrap).then((d) => d.team),
  removeMember: (wid, id, memberId) =>
    api.delete(`/workspaces/${wid}/teams/${id}/members/${memberId}`).then(unwrap).then((d) => d.team),
};

// ── User ──────────────────────────────────────────────────────────────────────
export const usersApi = {
  updateProfile: (payload) => api.patch('/users/profile', payload).then(unwrap).then((d) => d.user),
  changePassword: (payload) => api.post('/users/change-password', payload).then((r) => r.data),
};
