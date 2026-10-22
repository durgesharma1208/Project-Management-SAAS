import mongoose from 'mongoose';

/**
 * SavedFilter — persisted task view configuration scoped to a user + workspace.
 * Optional project scope for project-specific saved views.
 */
const savedFilterSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Optional: null means workspace-wide, set means project-scoped
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },

    name: { type: String, required: true, trim: true, maxlength: 100 },

    // Filter criteria — stored as plain object; validated on read/apply
    filters: {
      status: { type: [String], default: undefined },
      priority: { type: [String], default: undefined },
      assignee: { type: [String], default: undefined },
      labels: { type: [String], default: undefined },
      overdue: { type: Boolean, default: undefined },
      dueBefore: { type: Date, default: undefined },
      dueAfter: { type: Date, default: undefined },
      search: { type: String, default: undefined },
    },

    // Sort configuration
    sortField: {
      type: String,
      enum: ['title', 'status', 'priority', 'dueDate', 'startDate', 'updatedAt', 'createdAt', 'estimatedHours'],
      default: 'createdAt',
    },
    sortDir: { type: String, enum: ['asc', 'desc'], default: 'desc' },

    // View preferences (e.g. visible columns)
    viewPrefs: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// A user cannot have two saved filters with the same name in the same workspace
savedFilterSchema.index({ workspace: 1, user: 1, name: 1 }, { unique: true });
savedFilterSchema.index({ workspace: 1, user: 1, project: 1 });

const SavedFilter = mongoose.model('SavedFilter', savedFilterSchema);
export default SavedFilter;
