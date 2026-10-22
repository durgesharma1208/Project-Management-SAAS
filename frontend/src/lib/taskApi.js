/**
 * Shared task query keys and API helpers for consistent cache management.
 */
import api from './api';

// ── Query Key Factories ─────────────────────────────────────────────────────────
export const taskKeys = {
  all: (wid) => ['tasks', wid],
  list: (wid, filters) => ['tasks', wid, 'list', filters],
  detail: (wid, tid) => ['tasks', wid, 'detail', tid],
  calendar: (wid, range) => ['tasks', wid, 'calendar', range],
  dependencies: (wid, tid) => ['tasks', wid, 'dependencies', tid],
};

export const workflowKeys = {
  all: (wid) => ['workflows', wid],
  detail: (wid, id) => ['workflows', wid, id],
  projectWorkflow: (wid, pid) => ['workflows', wid, 'project', pid],
};

export const savedFilterKeys = {
  all: (wid, pid) => ['saved-filters', wid, pid ?? 'all'],
};

export const dependencyKeys = {
  graph: (wid, pid) => ['deps', wid, pid, 'graph'],
  task: (wid, tid) => ['deps', wid, tid],
};

export const criticalPathKeys = {
  project: (wid, pid) => ['critical-path', wid, pid],
};

// ── API helpers ─────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (wid, params) =>
    api.get(`/workspaces/${wid}/tasks`, { params }).then((r) => r.data.data),

  calendar: (wid, params) =>
    api.get(`/workspaces/${wid}/tasks/calendar`, { params }).then((r) => r.data.data),

  bulk: (wid, payload) =>
    api.post(`/workspaces/${wid}/tasks/bulk`, payload).then((r) => r.data),

  schedule: (wid, tid, payload) =>
    api.patch(`/workspaces/${wid}/tasks/${tid}/schedule`, payload).then((r) => r.data.data),

  getDependencies: (wid, tid) =>
    api.get(`/workspaces/${wid}/tasks/${tid}/dependencies`).then((r) => r.data.data),

  addDependency: (wid, tid, payload) =>
    api.post(`/workspaces/${wid}/tasks/${tid}/dependencies`, payload).then((r) => r.data.data),

  removeDependency: (wid, tid, depId) =>
    api.delete(`/workspaces/${wid}/tasks/${tid}/dependencies/${depId}`).then((r) => r.data),
};

export const workflowsApi = {
  list: (wid, params) =>
    api.get(`/workspaces/${wid}/workflows`, { params }).then((r) => r.data.data.workflows),

  get: (wid, id) =>
    api.get(`/workspaces/${wid}/workflows/${id}`).then((r) => r.data.data.workflow),

  create: (wid, payload) =>
    api.post(`/workspaces/${wid}/workflows`, payload).then((r) => r.data.data.workflow),

  update: (wid, id, payload) =>
    api.patch(`/workspaces/${wid}/workflows/${id}`, payload).then((r) => r.data.data.workflow),

  delete: (wid, id) =>
    api.delete(`/workspaces/${wid}/workflows/${id}`).then((r) => r.data),

  seedTemplates: (wid) =>
    api.post(`/workspaces/${wid}/workflows/seed-templates`).then((r) => r.data.data),

  getProjectWorkflow: (wid, pid) =>
    api.get(`/workspaces/${wid}/projects/${pid}/workflow`).then((r) => r.data.data),

  createFromTemplate: (wid, tmplId, payload) =>
    api.post(`/workspaces/${wid}/workflows/${tmplId}/create-from-template`, payload).then((r) => r.data.data.workflow),
};

export const savedFiltersApi = {
  list: (wid, pid) =>
    api.get(`/workspaces/${wid}/saved-filters`, { params: pid ? { project: pid } : {} }).then((r) => r.data.data.filters),

  create: (wid, payload) =>
    api.post(`/workspaces/${wid}/saved-filters`, payload).then((r) => r.data.data.filter),

  update: (wid, id, payload) =>
    api.patch(`/workspaces/${wid}/saved-filters/${id}`, payload).then((r) => r.data.data.filter),

  delete: (wid, id) =>
    api.delete(`/workspaces/${wid}/saved-filters/${id}`).then((r) => r.data),
};

export const dependencyApi = {
  graph: (wid, pid) =>
    api.get(`/workspaces/${wid}/projects/${pid}/dependency-graph`).then((r) => r.data.data),
};

export const criticalPathApi = {
  get: (wid, pid) =>
    api.get(`/workspaces/${wid}/projects/${pid}/critical-path`).then((r) => r.data.data),
};
