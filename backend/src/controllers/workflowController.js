/**
 * Workflow Controller
 * Routes: /api/workspaces/:workspaceId/workflows
 */
import { z } from 'zod';
import Workflow, { WORKFLOW_TEMPLATES } from '../models/Workflow.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { createError } from '../middleware/errorHandler.js';

const STATUS_CATEGORIES = ['not_started', 'active', 'completed', 'cancelled'];

const statusSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Status id must be lowercase alphanumeric/underscore'),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be hex').optional().default('#6366f1'),
  category: z.enum(STATUS_CATEGORIES).optional().default('active'),
  position: z.number().int().min(0).optional().default(0),
});

const transitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const workflowBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  statuses: z.array(statusSchema).min(1),
  transitions: z.array(transitionSchema).optional().default([]),
  isDefault: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
});

// ── Validate status/transition consistency ─────────────────────────────────────
const validateWorkflowData = (statuses, transitions) => {
  const ids = new Set(statuses.map((s) => s.id));

  // Check for duplicate status IDs
  if (ids.size !== statuses.length) throw createError('Workflow has duplicate status IDs', 422);

  // Check transitions reference valid status IDs
  for (const t of transitions) {
    if (!ids.has(t.from)) throw createError(`Transition from "${t.from}" references unknown status`, 422);
    if (!ids.has(t.to)) throw createError(`Transition to "${t.to}" references unknown status`, 422);
    if (t.from === t.to) throw createError(`Self-transition "${t.from}" → "${t.to}" is not allowed`, 422);
  }

  // Check for duplicate transitions
  const transitionKeys = transitions.map((t) => `${t.from}→${t.to}`);
  if (new Set(transitionKeys).size !== transitionKeys.length) {
    throw createError('Workflow has duplicate transitions', 422);
  }
};

// ── List workflows ─────────────────────────────────────────────────────────────
export const getWorkflows = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { templates } = req.query;

    const query = { workspace: workspaceId };
    if (templates === 'true') query.isTemplate = true;
    else if (templates === 'false') query.isTemplate = { $ne: true };

    const workflows = await Workflow.find(query).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, data: { workflows } });
  } catch (err) {
    next(err);
  }
};

// ── Get single workflow ────────────────────────────────────────────────────────
export const getWorkflow = async (req, res, next) => {
  try {
    const { workspaceId, workflowId } = req.params;
    const workflow = await Workflow.findOne({ _id: workflowId, workspace: workspaceId });
    if (!workflow) throw createError('Workflow not found', 404);
    res.json({ success: true, data: { workflow } });
  } catch (err) {
    next(err);
  }
};

// ── Create workflow ────────────────────────────────────────────────────────────
export const createWorkflow = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const data = workflowBodySchema.parse(req.body);
    validateWorkflowData(data.statuses, data.transitions);

    // If setting as default, unset previous default
    if (data.isDefault) {
      await Workflow.updateMany({ workspace: workspaceId, isDefault: true }, { $set: { isDefault: false } });
    }

    const workflow = await Workflow.create({
      ...data,
      workspace: workspaceId,
      createdBy: req.userId,
    });

    res.status(201).json({ success: true, data: { workflow } });
  } catch (err) {
    next(err);
  }
};

// ── Update workflow ────────────────────────────────────────────────────────────
export const updateWorkflow = async (req, res, next) => {
  try {
    const { workspaceId, workflowId } = req.params;
    const data = workflowBodySchema.partial().parse(req.body);

    const workflow = await Workflow.findOne({ _id: workflowId, workspace: workspaceId });
    if (!workflow) throw createError('Workflow not found', 404);

    // Validate status/transition consistency if either is being updated
    const mergedStatuses = data.statuses ?? workflow.statuses;
    const mergedTransitions = data.transitions ?? workflow.transitions;
    if (data.statuses || data.transitions) {
      validateWorkflowData(mergedStatuses, mergedTransitions);
    }

    // If removing a status, check if any task uses it
    if (data.statuses) {
      const newIds = new Set(data.statuses.map((s) => s.id));
      const removedIds = workflow.statuses
        .filter((s) => !newIds.has(s.id))
        .map((s) => s.id);

      if (removedIds.length > 0) {
        const count = await Task.countDocuments({
          workspace: workspaceId,
          workflowId: workflowId,
          status: { $in: removedIds },
        });
        if (count > 0) {
          throw createError(
            `Cannot remove statuses still in use by ${count} task(s). Migrate those tasks first.`,
            409
          );
        }
      }
    }

    // If setting as default, unset previous default
    if (data.isDefault && !workflow.isDefault) {
      await Workflow.updateMany(
        { workspace: workspaceId, isDefault: true, _id: { $ne: workflowId } },
        { $set: { isDefault: false } }
      );
    }

    Object.assign(workflow, data);
    await workflow.save();

    res.json({ success: true, data: { workflow } });
  } catch (err) {
    next(err);
  }
};

// ── Delete workflow ────────────────────────────────────────────────────────────
export const deleteWorkflow = async (req, res, next) => {
  try {
    const { workspaceId, workflowId } = req.params;
    const workflow = await Workflow.findOne({ _id: workflowId, workspace: workspaceId });
    if (!workflow) throw createError('Workflow not found', 404);

    // Check if any project uses this workflow
    const projectCount = await Project.countDocuments({ workspace: workspaceId, workflowId });
    if (projectCount > 0) {
      throw createError(
        `Cannot delete workflow — ${projectCount} project(s) are using it. Reassign those projects first.`,
        409
      );
    }

    await workflow.deleteOne();
    res.json({ success: true, message: 'Workflow deleted' });
  } catch (err) {
    next(err);
  }
};

// ── Seed workflow templates ────────────────────────────────────────────────────
export const seedWorkflowTemplates = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    const created = [];
    for (const tmpl of WORKFLOW_TEMPLATES) {
      const exists = await Workflow.findOne({ workspace: workspaceId, name: tmpl.name, isTemplate: true });
      if (!exists) {
        const wf = await Workflow.create({
          ...tmpl,
          workspace: workspaceId,
          createdBy: req.userId,
          isTemplate: true,
        });
        created.push(wf);
      }
    }

    const all = await Workflow.find({ workspace: workspaceId, isTemplate: true });
    res.json({ success: true, data: { seeded: created.length, templates: all } });
  } catch (err) {
    next(err);
  }
};

// ── Get project's effective workflow ──────────────────────────────────────────
export const getProjectWorkflow = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;
    const { resolveWorkflowForProject } = await import('../services/workflowService.js');
    const workflow = await resolveWorkflowForProject(projectId, workspaceId);
    if (!workflow) {
      // Return built-in permissive fallback info
      return res.json({
        success: true,
        data: {
          workflow: null,
          message: 'No workflow assigned; all status transitions are permitted.',
        },
      });
    }
    res.json({ success: true, data: { workflow } });
  } catch (err) {
    next(err);
  }
};

// ── Create workflow from template ──────────────────────────────────────────────
export const createFromTemplate = async (req, res, next) => {
  try {
    const { workspaceId, workflowId } = req.params;
    const { name, description } = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    }).parse(req.body);

    const template = await Workflow.findOne({ _id: workflowId, workspace: workspaceId, isTemplate: true });
    if (!template) throw createError('Workflow template not found', 404);

    const workflow = await Workflow.create({
      workspace: workspaceId,
      name,
      description: description || template.description,
      statuses: template.statuses,
      transitions: template.transitions,
      isDefault: false,
      isTemplate: false,
      createdBy: req.userId,
    });

    res.status(201).json({ success: true, data: { workflow } });
  } catch (err) {
    next(err);
  }
};
