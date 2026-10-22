import mongoose from 'mongoose';

// Generic activity/audit event — extensible for audit log enhancements later
const activitySchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    // Optional: scoped to a project or task
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null, index: true },

    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Event type e.g. "task.created", "task.status_changed", "project.created"
    type: { type: String, required: true },

    // Human-readable summary
    summary: { type: String, required: true },

    // Flexible diff/payload — stores before/after for status changes etc.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

activitySchema.index({ workspace: 1, createdAt: -1 });
activitySchema.index({ project: 1, createdAt: -1 });
activitySchema.index({ task: 1, createdAt: -1 });

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;
