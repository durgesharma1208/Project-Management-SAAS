# TaskFlow — frontend

React 19 + Vite + Tailwind single-page app for the TaskFlow API.

```bash
npm install
npm run dev     # http://localhost:5173 (proxies /api → http://localhost:5000)
npm run build   # production bundle in dist/
npm run lint    # eslint (react-hooks rules enabled)
```

See the [root README](../README.md) for full setup instructions, the API surface
and the design/architecture notes.

## Structure

```
src/
  components/
    ui/        design-system primitives (Dialog, Menu, Toast, Tabs, Form,
               Badge, Primitives, ConfirmDialog, Alert, Avatar, Spinner)
    layout/    AppLayout, Sidebar, TopNav, CommandPalette
    tasks/     TaskFormDialog, TaskPanel, TaskListItem
    projects/  ProjectFormDialog
  contexts/    AuthContext (session), WorkspaceContext (active workspace + role)
  hooks/       useMembers (cached workspace member list)
  lib/         api (axios + refresh queue), taskApi (resources + query keys),
               constants (status/priority metadata), format (date helpers)
  pages/       auth, dashboard, projects (+board/calendar/gantt/dependencies/
               critical-path), tasks, teams, settings
```

## Design system

Tokens live in `tailwind.config.js` (colours, radii, shadows, animations) and the
component classes in `src/index.css`:

- Layout: `.page`, `.card`, `.section-title`, `.table-head`, `.divider`
- Actions: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-subtle`,
  `.btn-danger`, `.btn-icon`, `.btn-sm`, `.btn-lg`
- Forms: `.input`, `.input-sm`, `.label`, `.hint`, `.input-error`
- Fragments: `.badge`, `.chip`, `.kbd`, `.status-dot`, `.nav-item`, `.dropdown`,
  `.dialog-panel`, `.skeleton`

Pages compose these classes plus the components in `components/ui`; they do not
define their own buttons or inputs.

## Background & motion

The authentication screens sit on an **aurora mesh** (`components/layout/AuroraBackground.jsx`):
three or four oversized radial-gradient clouds drifting on independent 26–38s
loops, over a faint masked grid and an inline SVG grain overlay.

- Pure CSS — no canvas, no animation library, no timers, nothing to clean up.
- The falloff lives inside the gradient, so there is no `filter: blur()` cost.
- `prefers-reduced-motion: reduce` keeps the composition but stops the drift.
- Cards on top use `.glass-card` (translucent white + backdrop blur + inner
  highlight), so they float rather than sit on the colour.
- Only the auth screens, the invitation page and the empty-workspace card use it;
  working surfaces (board, list, dashboard) stay on flat `surface-50` so text
  keeps full contrast and the app stays quiet.

All five auth screens share `components/layout/AuthShell.jsx`, so the brand mark,
card width and spacing can only change in one place.

## Notes

- `/api` is always called relative — no hard-coded backend host in the browser.
- TanStack Query owns all server state; every mutation invalidates the keys it
  touches (see `lib/taskApi.js`).
- The board/calendar/gantt/dependency views are lazy-loaded to keep the first
  paint small.
