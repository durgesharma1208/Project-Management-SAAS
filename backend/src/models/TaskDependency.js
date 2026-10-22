import mongoose from 'mongoose';

/**
 * TaskDependency — represents a directed dependency relationship between two tasks.
 *
 * Design: Separate collection (not embedded in Task) to:
 * 1. Efficiently query all predecessors/successors of a task.
 * 2. Prevent circular reference issues in the Task document itself.
 * 3. Support richer dependency metadata in the future (lag time, dependency type).
 *
 * Currently only 'finish_to_start' is implemented, but the type field allows
 * adding 'start_to_start', 'finish_to_finish', 'start_to_finish' later.
 *
 * Semantics: predecessor must finish before successor can start (finish_to_start).
 */
const taskDependencySchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },

    predecessor: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    successor: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },

    type: {
      type: String,
      enum: ['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'],
      default: 'finish_to_start',
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Prevent duplicate dependency relationships
taskDependencySchema.index({ predecessor: 1, successor: 1 }, { unique: true });
taskDependencySchema.index({ workspace: 1, project: 1 });
taskDependencySchema.index({ successor: 1 });  // for "find predecessors of task X"

const TaskDependency = mongoose.model('TaskDependency', taskDependencySchema);
export default TaskDependency;
