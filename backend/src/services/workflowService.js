/**
 * Workflow Transition Validation Service
 *
 * Single source of truth for validating task status transitions.
 * Used by: task controller (updateTask, moveTask), bulk controller.
 * Ensures the Kanban board and bulk actions use identical validation logic.
 */
import Workflow from '../models/Workflow.js';
import Project from '../models/Project.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * Resolve the effective workflow for a project.
 * Precedence: project.workflowId → workspace default workflow → built-in permissive fallback.
 *
 * @param {string} projectId
 * @param {string} workspaceId
 * @returns {Promise<WorkflowDocument|null>}
 */
export const resolveWorkflowForProject = async (projectId, workspaceId) => {
  const project = await Project.findOne({ _id: projectId, workspace: workspaceId });
  if (!project) return null;

  if (project.workflowId) {
    const wf = await Workflow.findOne({ _id: project.workflowId, workspace: workspaceId });
    if (wf) return wf;
  }

  // Fallback: workspace default workflow
  const defaultWf = await Workflow.findOne({ workspace: workspaceId, isDefault: true });
  return defaultWf || null;
};

/**
 * Validate a status transition against the project's assigned workflow.
 *
 * If no workflow is found for the project, the transition is PERMITTED
 * (backward-compatible: existing projects without workflows are unrestricted).
 *
 * @param {string} projectId
 * @param {string} workspaceId
 * @param {string} fromStatus - current status
 * @param {string} toStatus - requested status
 * @throws {Error} with statusCode 422 if transition is not allowed
 */
export const validateTransition = async (projectId, workspaceId, fromStatus, toStatus) => {
  // Same-status move is always valid
  if (fromStatus === toStatus) return;

  const workflow = await resolveWorkflowForProject(projectId, workspaceId);
  if (!workflow) return; // no workflow → any transition allowed

  // Check the 'to' status exists in workflow
  const toStatusExists = workflow.statuses.some((s) => s.id === toStatus);
  if (!toStatusExists) {
    throw createError(
      `Status "${toStatus}" is not part of the project's workflow "${workflow.name}"`,
      422
    );
  }

  // Check the transition is explicitly allowed
  const allowed = workflow.transitions.some(
    (t) => t.from === fromStatus && t.to === toStatus
  );
  if (!allowed) {
    // Build helpful message showing valid next statuses
    const validNextIds = workflow.transitions
      .filter((t) => t.from === fromStatus)
      .map((t) => t.to);
    const validNextNames = workflow.statuses
      .filter((s) => validNextIds.includes(s.id))
      .map((s) => s.name);

    throw createError(
      `Transition from "${fromStatus}" to "${toStatus}" is not allowed by workflow "${workflow.name}". ` +
      (validNextNames.length
        ? `Allowed next statuses: ${validNextNames.join(', ')}.`
        : 'No transitions are configured from this status.'),
      422
    );
  }
};

/**
 * Get all valid next statuses for a task at its current status,
 * given the project's workflow.
 *
 * @param {string} projectId
 * @param {string} workspaceId
 * @param {string} currentStatus
 * @returns {Promise<Array<{id, name, color, category}>>}
 */
export const getValidNextStatuses = async (projectId, workspaceId, currentStatus) => {
  const workflow = await resolveWorkflowForProject(projectId, workspaceId);
  if (!workflow) return []; // no workflow

  const validNextIds = workflow.transitions
    .filter((t) => t.from === currentStatus)
    .map((t) => t.to);

  return workflow.statuses.filter((s) => validNextIds.includes(s.id));
};