import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One user per workspace
membershipSchema.index({ workspace: 1, user: 1 }, { unique: true });

const Membership = mongoose.model('Membership', membershipSchema);
export default Membership;
