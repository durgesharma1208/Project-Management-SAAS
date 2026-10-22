import Membership from '../models/Membership.js';
import Workspace from '../models/Workspace.js';

/**
 * Middleware factory: verifies the user is a member of the workspace.
 * The workspaceId must be in req.params.workspaceId or req.body.workspaceId.
 * Attaches req.workspace and req.membership.
 *
 * Usage: requireWorkspaceMember()            — any member
 *        requireWorkspaceMember('admin')     — admin or owner
 *        requireWorkspaceMember('owner')     — owner only
 */
export const requireWorkspaceMember = (minRole = 'member') => async (req, res, next) => {
  try {
    const workspaceId = req.params.workspaceId || req.body.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID is required' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || !workspace.isActive) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const membership = await Membership.findOne({ workspace: workspaceId, user: req.userId });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this workspace' });
    }

    const roleRank = { member: 1, admin: 2, owner: 3 };
    const required = roleRank[minRole] || 1;
    const actual = roleRank[membership.role] || 1;
    if (actual < required) {
      return res.status(403).json({ success: false, message: `Requires ${minRole} role or higher` });
    }

    req.workspace = workspace;
    req.membership = membership;
    next();
  } catch (err) {
    next(err);
  }
};

export default { requireWorkspaceMember };
