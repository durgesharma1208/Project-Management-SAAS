# TaskFlow — Project Management SaaS

TaskFlow is a full-stack project management app: workspaces, projects, tasks with
subtasks and comments, a drag-and-drop board, a filterable list, a calendar, a
Gantt-style timeline, task dependencies and a critical-path (CPM) scheduler,
customisable workflows, teams and workspace administration.

The UI is a single-page React app with a consistent design system, and the API is
a JSON REST service backed by MongoDB.

> **Status:** development build. The frontend is verified with `eslint` and a
> production `vite build`; the backend has unit tests plus an HTTP smoke test.
> A running MongoDB instance is required — the app is not usable without one
> (there is no mock/demo data layer).

---

## Stack

| Layer    | Tech |
| -------- | ---- |
| Frontend | React 19, Vite, React Router 7, TanStack Query, Tailwind CSS, react-hook-form + zod |
| Board    | `@hello-pangea/dnd` |
| Graph    | `@xyflow/react` (dependency map) |
| Charts   | inline SVG/CSS (no chart dependency) |
| Backend  | Node.js, Express 5, Mongoose 8, JWT (access + refresh cookies), zod |
| Database | MongoDB (local or Atlas) |
| Tests    | `node --test` (CPM + query-builder units) |

No paid services, API keys or AI providers are needed.

---

## Features

**Workspaces & access**
- Multiple workspaces per user, role-based access (`owner` / `admin` / `member`).
- Email invitations with tokens, pending-invite list and revocation.
- Workspace settings (name, description, accent colour) and member role changes.

**Projects**
- Create, edit, archive/restore and delete (cascades tasks, comments and activity).
- Status, priority, owner, members, team, emoji, colour and dates.
- Progress derived from task completion counts.

**Tasks**
- Create/edit/delete, subtasks, labels, assignee, priority, start/due dates,
  estimated hours and explicit duration (used by CPM).
- Comments with author-only edit/delete, and a per-task activity log.
- Bulk actions (status, priority, assignee, delete), saved filters, sorting and
  pagination.

**Views**
- **Board** — columns from the project workflow, drag-and-drop with optimistic
  updates, inline task creation, search/assignee/priority filters.
- **List** — table view with multi-select, bulk actions, saved views, deep links.
- **Calendar** — month grid of due dates, per-day task creation.
- **Timeline** — Gantt-style bars with 14/30/60-day ranges and undated tasks.
- **Dependencies** — finish-to-start links, cycle detection, interactive graph.
- **Critical path** — CPM with earliest/latest start/finish and slack per task.

**Workflows**
- Custom statuses and transitions, default workflow per workspace, templates.
- The board and the transition validation both read from the same workflow.

**Dashboard**
- Real aggregates: open/completed/overdue/due-today counts, weekly completion
  trend, open-by-priority, recent projects, upcoming deadlines and activity feed.

**Teams**
- Create/edit/delete teams and manage team members and leads.

**Global UX**
- Collapsible sidebar (drawer on mobile), breadcrumb top bar, ⌘K command palette
  searching tasks and projects, activity notifications, toasts, dialogs, drawers,
  skeletons, empty/error states, keyboard-accessible menus.

---

## Repository layout

```
backend/
  src/
    config/           database connection (retries instead of crashing)
    controllers/      auth, workspace, project, task, subtask, comment,
                      team, workflow, saved-filter, dependency, CPM
    middleware/       JWT auth, workspace membership/roles, errors, metrics
    models/           User, Workspace, Membership, Invitation, Project, Task,
                      Comment, Activity, Team, Workflow, SavedFilter, TaskDependency
    routes/           Express routers mounted under /api
    services/         auth tokens, CPM scheduler, workflow rules, task query builder
    seed.js           demo workspace + projects + tasks
  tests/              node:test unit tests
frontend/
  src/
    components/       ui kit, app shell, task dialog/drawer, project dialog
    contexts/         auth + workspace session
    hooks/            shared member list
    lib/              axios client, API resource helpers, constants, formatting
    pages/            auth, dashboard, projects, tasks, teams, settings
```

---

## Getting started

### 1. Backend

```bash
cd backend
cp .env.example .env          # then edit the values
npm install
```

Generate JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

`backend/.env` needs at least:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/taskflow   # or an Atlas SRV URI
JWT_ACCESS_SECRET=<random>
JWT_REFRESH_SECRET=<different random>
CLIENT_URL=http://localhost:5173
```

Start it:

```bash
npm run dev        # node --watch
npm start          # plain node
npm run seed       # optional demo workspace (demo@taskflow.dev / Demo1234!)
npm test           # unit tests
```

API base: `http://localhost:5000/api` — health check at `/api/health`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
npm run lint
```

The dev server proxies `/api` to `http://localhost:5000` (override with
`VITE_PROXY_TARGET`). The browser always calls the relative `/api` path, so no
CORS configuration is needed for local development.

### 3. Production notes

- Serve `frontend/dist` behind the same origin as the API (nginx `try_files` +
  `proxy_pass /api`) so cookies stay first-party.
- Set `NODE_ENV=production` and an explicit `CLIENT_URL` allow-list; the
  permissive origin matching for `localhost` and `*.e2b.app` only applies outside
  production.
- Serve over HTTPS; refresh cookies are `httpOnly` and `sameSite=lax`.

---

## API overview

All responses use `{ success, data }` (errors: `{ success: false, message }`).

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/api/auth/register`, `/login`, `/refresh`, `/logout` | JWT access token + refresh cookie |
| POST | `/api/auth/forgot-password`, `/reset-password` | Reset link printed to console if SMTP is unset |
| GET/PATCH | `/api/users/profile`, `/api/users/change-password` | Own account |
| GET/POST | `/api/workspaces` | List / create |
| PATCH | `/api/workspaces/:id` | Admin |
| GET/PATCH/DELETE | `/api/workspaces/:id/members[/:memberId]` | Admin for mutations |
| GET/POST/DELETE | `/api/workspaces/:id/invitations[/:invitationId]` | Admin |
| GET | `/api/workspaces/:id/activity` | Workspace activity feed |
| GET/POST | `/api/workspaces/:id/projects` | List / create |
| GET/PATCH/DELETE | `/api/workspaces/:id/projects/:projectId` | Detail / edit / delete |
| POST | `.../projects/:projectId/archive`, `/restore` | Archive lifecycle |
| GET | `.../projects/:projectId/activity`, `/workflow`, `/dependency-graph`, `/critical-path` | Project features |
| GET/POST | `/api/workspaces/:id/tasks` | Filter, sort, paginate / create |
| PATCH/DELETE | `.../tasks/:taskId` | Update / delete |
| POST | `.../tasks/:taskId/move`, `/schedule` | Status move / CPM dates |
| GET | `/api/workspaces/:id/tasks/dashboard`, `/calendar` | Aggregates |
| POST | `/api/workspaces/:id/tasks/bulk` | Bulk update/delete |
| GET/POST/DELETE | `.../tasks/:taskId/subtasks…` | Subtasks |
| GET/POST/PATCH/DELETE | `.../tasks/:taskId/comments…` | Comments |
| GET/POST/DELETE | `.../tasks/:taskId/dependencies…` | Predecessor links |
| GET/POST | `/api/workspaces/:id/workflows`, `/seed-templates` | Workflows |
| GET/POST/PATCH/DELETE | `/api/workspaces/:id/teams…` | Teams |
| GET/POST/PATCH/DELETE | `/api/workspaces/:id/saved-filters…` | Saved task views |

### Task list query parameters

`project`, `status`, `priority`, `assignee` (`me` allowed), `unassigned=true`,
`labels`, `search`, `overdue=true`, `includeDone=true`, `dueBefore`, `dueAfter`,
`myTasks=true`, `sort` (`manual|createdAt|updatedAt|dueDate|startDate|title|priority|status`),
`dir` (`asc|desc`), `page`, `limit` (max 200).

List responses are paginated:

```json
{ "success": true, "data": { "tasks": [], "total": 0, "page": 1, "limit": 50, "totalPages": 1 } }
```

---

## Testing

```bash
cd backend  && npm test        # CPM scheduler + task-query builder (10 tests)
cd backend  && npm run check   # syntax check the server entry point
cd frontend && npm run lint    # eslint incl. react-hooks rules
cd frontend && npm run build   # production bundle
cd frontend && npm run test:render
```

`npm run test:render` mounts every screen in jsdom against a mocked API
(`frontend/scripts/render-smoke`) and asserts that all 19 pages render with data
and no console errors, then exercises six interactions: open/close the task
drawer, the create-task dialog, the create-project dialog, the board's inline
composer and the ⌘K palette.

There is no integration test suite against a live database: the API contract is
covered by the unit tests and an HTTP smoke check (health, 404, 401, 422, CORS),
and database-backed flows are verified manually once MongoDB is running.

---

## Known limitations

- Email delivery only works when SMTP variables are set; otherwise invitation and
  password-reset links are logged to the server console.
- Deleting a task also deletes its dependencies and comments, but activity
  history is retained for audit purposes.
- The Gantt timeline is a read-only visualisation (dates are edited in the task
  drawer), and drag-to-reschedule is not implemented.
- No dark theme yet — the design tokens exist, the surfaces are light-only.
