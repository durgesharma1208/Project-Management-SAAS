import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000, default: '' },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['planned', 'active', 'on_hold', 'completed', 'archived'],
      default: 'planned',
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    color: { type: String, default: '#6366f1' },
    emoji: { type: String, default: '📋' },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    isArchived: { type: Boolean, default: false },
    // Feature 7 — Blueprint Engine: workflow assigned to this project (null = use workspace default)
    workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', default: null },
    // Extension point: custom fields, github repo, etc.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

projectSchema.index({ workspace: 1, status: 1 });
projectSchema.index({ workspace: 1, isArchived: 1 });

const Project = mongoose.model('Project', projectSchema);
export default Project;
