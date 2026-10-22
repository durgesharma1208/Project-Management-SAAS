import mongoose from 'mongoose';

/**
 * Status categories for UI grouping and default behavior.
 */
export const STATUS_CATEGORIES = ['not_started', 'active', 'completed', 'cancelled'];

/**
 * Workflow — defines the set of statuses and allowed transitions for tasks in a project.
 *
 * Design decisions:
 * - statuses and transitions are embedded (arrays) since they are always read with the workflow.
 * - Templates are stored as real Workflow documents with isTemplate:true so they can be
 *   duplicated and customized, rather than being hardcoded constants.
 * - Each status has a stable string `id` (slug) distinct from MongoDB _id, so task.status
 *   (which stores this string) does not need ObjectId lookups.
 */
const workflowStatusSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },      // slug e.g. "in_progress"
    name: { type: String, required: true, trim: true },     // display name e.g. "In Progress"
    color: { type: String, default: '#6366f1' },            // hex color
    category: { type: String, enum: STATUS_CATEGORIES, default: 'active' },
    position: { type: Number, default: 0 },                 // display order
  },
  { _id: false }
);

const workflowTransitionSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },  // status.id
    to: { type: String, required: true },    // status.id
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500, default: '' },

    statuses: { type: [workflowStatusSchema], default: [] },
    transitions: { type: [workflowTransitionSchema], default: [] },

    // If true, this is the workspace-wide default assigned to new projects
    isDefault: { type: Boolean, default: false },

    // If true, this is a reusable template (not assigned to projects directly)
    isTemplate: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

workflowSchema.index({ workspace: 1, isDefault: 1 });
workflowSchema.index({ workspace: 1, isTemplate: 1 });

const Workflow = mongoose.model('Workflow', workflowSchema);
export default Workflow;

/**
 * Built-in workflow templates.
 * These are seeded as real Workflow documents (isTemplate: true) on first workspace setup.
 */
export const WORKFLOW_TEMPLATES = [
  {
    name: 'Standard Project',
    description: 'Simple workflow suitable for general projects.',
    statuses: [
      { id: 'backlog',     name: 'Backlog',     color: '#94a3b8', category: 'not_started', position: 0 },
      { id: 'todo',        name: 'To Do',       color: '#3b82f6', category: 'not_started', position: 1 },
      { id: 'in_progress', name: 'In Progress', color: '#f59e0b', category: 'active',      position: 2 },
      { id: 'done',        name: 'Done',        color: '#22c55e', category: 'completed',   position: 3 },
    ],
    transitions: [
      { from: 'backlog', to: 'todo' },
      { from: 'todo', to: 'in_progress' },
      { from: 'in_progress', to: 'done' },
      { from: 'in_progress', to: 'todo' },
      { from: 'todo', to: 'backlog' },
      { from: 'done', to: 'in_progress' },
    ],
  },
  {
    name: 'Software Development',
    description: 'Full development lifecycle including code review and testing.',
    statuses: [
      { id: 'backlog',     name: 'Backlog',     color: '#94a3b8', category: 'not_started', position: 0 },
      { id: 'todo',        name: 'To Do',       color: '#3b82f6', category: 'not_started', position: 1 },
      { id: 'in_progress', name: 'In Progress', color: '#f59e0b', category: 'active',      position: 2 },
      { id: 'in_review',   name: 'In Review',   color: '#8b5cf6', category: 'active',      position: 3 },
      { id: 'done',        name: 'Done',        color: '#22c55e', category: 'completed',   position: 4 },
    ],
    transitions: [
      { from: 'backlog',     to: 'todo' },
      { from: 'todo',        to: 'in_progress' },
      { from: 'in_progress', to: 'in_review' },
      { from: 'in_review',   to: 'done' },
      { from: 'in_review',   to: 'in_progress' },
      { from: 'in_progress', to: 'todo' },
      { from: 'todo',        to: 'backlog' },
      { from: 'done',        to: 'in_review' },
    ],
  },
  {
    name: 'Bug Resolution',
    description: 'Track bugs from report to resolution.',
    statuses: [
      { id: 'backlog',     name: 'Reported',    color: '#ef4444', category: 'not_started', position: 0 },
      { id: 'todo',        name: 'Confirmed',   color: '#f97316', category: 'not_started', position: 1 },
      { id: 'in_progress', name: 'In Progress', color: '#f59e0b', category: 'active',      position: 2 },
      { id: 'in_review',   name: 'Testing',     color: '#8b5cf6', category: 'active',      position: 3 },
      { id: 'done',        name: 'Resolved',    color: '#22c55e', category: 'completed',   position: 4 },
    ],
    transitions: [
      { from: 'backlog',     to: 'todo' },
      { from: 'todo',        to: 'in_progress' },
      { from: 'in_progress', to: 'in_review' },
      { from: 'in_review',   to: 'done' },
      { from: 'in_review',   to: 'in_progress' },
      { from: 'todo',        to: 'backlog' },
    ],
  },
];
