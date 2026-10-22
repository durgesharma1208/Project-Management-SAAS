/**
 * Seed script — creates demo data for local development.
 * Run with: npm run seed
 *
 * Creates:
 *   - 1 demo user (demo@taskflow.dev / Demo1234!)
 *   - 1 workspace
 *   - 2 teams
 *   - 3 projects
 *   - 12 tasks spread across Kanban columns
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './src/models/User.js';
import Workspace from './src/models/Workspace.js';
import Membership from './src/models/Membership.js';
import Team from './src/models/Team.js';
import Project from './src/models/Project.js';
import Task from './src/models/Task.js';
import Activity from './src/models/Activity.js';

await mongoose.connect(process.env.MONGODB_URI);
console.log('🌱 Connected to MongoDB, seeding…');

// Clean existing demo data
await User.deleteOne({ email: 'demo@taskflow.dev' });

// ── User ───────────────────────────────────────────────────────────────────────
const user = await User.create({
  name: 'Alex Demo',
  email: 'demo@taskflow.dev',
  password: 'Demo1234!',
  jobTitle: 'Product Manager',
  bio: 'Demo account for TaskFlow',
});

// ── Workspace ──────────────────────────────────────────────────────────────────
const workspace = await Workspace.create({
  name: 'Acme Corp',
  slug: 'acme-corp-demo',
  description: 'Main workspace for Acme Corp projects',
  color: '#6366f1',
  owner: user._id,
});
await Membership.create({ workspace: workspace._id, user: user._id, role: 'owner' });

// ── Teams ──────────────────────────────────────────────────────────────────────
await Team.create({
  name: 'Engineering',
  emoji: '⚙️',
  description: 'Core product engineering team',
  workspace: workspace._id,
  createdBy: user._id,
  members: [{ user: user._id, role: 'lead' }],
});
await Team.create({
  name: 'Design',
  emoji: '🎨',
  description: 'UX and product design',
  workspace: workspace._id,
  createdBy: user._id,
  members: [{ user: user._id, role: 'member' }],
});

// ── Projects ───────────────────────────────────────────────────────────────────
const projects = await Project.insertMany([
  {
    name: 'TaskFlow v1.0 Launch',
    emoji: '🚀',
    color: '#6366f1',
    description: 'Initial product launch with core features',
    workspace: workspace._id,
    owner: user._id,
    members: [user._id],
    status: 'active',
    priority: 'high',
    dueDate: new Date(Date.now() + 30 * 86400 * 1000),
  },
  {
    name: 'Mobile App',
    emoji: '📱',
    color: '#8b5cf6',
    description: 'Native iOS and Android application',
    workspace: workspace._id,
    owner: user._id,
    members: [user._id],
    status: 'planned',
    priority: 'medium',
  },
  {
    name: 'API Integrations',
    emoji: '🔌',
    color: '#06b6d4',
    description: 'Third-party API integrations: GitHub, Slack, Jira',
    workspace: workspace._id,
    owner: user._id,
    members: [user._id],
    status: 'active',
    priority: 'medium',
    dueDate: new Date(Date.now() + 60 * 86400 * 1000),
  },
]);

const [p1, p2, p3] = projects;

// ── Tasks ──────────────────────────────────────────────────────────────────────
const taskDefs = [
  // TaskFlow v1.0 Launch
  { title: 'Set up CI/CD pipeline', status: 'done', priority: 'high', project: p1._id, labels: ['devops'] },
  { title: 'Design system and component library', status: 'done', priority: 'high', project: p1._id, labels: ['design', 'frontend'] },
  { title: 'Authentication and user management', status: 'in_review', priority: 'urgent', project: p1._id, labels: ['backend'] },
  { title: 'Kanban board with drag-and-drop', status: 'in_progress', priority: 'high', project: p1._id, dueDate: new Date(Date.now() + 3 * 86400 * 1000), labels: ['frontend'] },
  { title: 'Project management CRUD', status: 'in_progress', priority: 'high', project: p1._id, labels: ['backend', 'frontend'] },
  { title: 'Email notification system', status: 'todo', priority: 'medium', project: p1._id },
  { title: 'Write API documentation', status: 'backlog', priority: 'low', project: p1._id },

  // Mobile App
  { title: 'Define mobile app architecture', status: 'todo', priority: 'high', project: p2._id },
  { title: 'Wireframes and prototypes', status: 'in_progress', priority: 'medium', project: p2._id, labels: ['design'] },

  // API Integrations
  { title: 'GitHub webhook integration', status: 'todo', priority: 'high', project: p3._id, labels: ['integration'] },
  { title: 'Slack notifications', status: 'backlog', priority: 'medium', project: p3._id, labels: ['integration'] },
  { title: 'OAuth 2.0 provider setup', status: 'in_progress', priority: 'high', project: p3._id, dueDate: new Date(Date.now() + 7 * 86400 * 1000) },
];

const tasks = await Task.insertMany(
  taskDefs.map((t, i) => ({
    ...t,
    workspace: workspace._id,
    creator: user._id,
    assignee: user._id,
    position: i,
  }))
);

// ── Activities ─────────────────────────────────────────────────────────────────
await Activity.insertMany(
  projects.map(p => ({
    workspace: workspace._id,
    project: p._id,
    actor: user._id,
    type: 'project.created',
    summary: `Project "${p.name}" created`,
    data: { projectName: p.name },
  }))
);

await mongoose.disconnect();
console.log(`
✅ Seed complete!

Demo credentials:
  Email:    demo@taskflow.dev
  Password: Demo1234!

Created:
  1 workspace (Acme Corp)
  2 teams
  ${projects.length} projects
  ${tasks.length} tasks
`);
