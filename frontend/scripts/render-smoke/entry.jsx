/* Offline render smoke test: mounts every page against the mock API in jsdom. */
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { WorkspaceProvider } from '../../src/contexts/WorkspaceContext';
import { ToastProvider } from '../../src/components/ui/Toast';

import { DashboardPage } from '../../src/pages/dashboard/DashboardPage';
import { ProjectsPage } from '../../src/pages/projects/ProjectsPage';
import { ProjectDetailPage } from '../../src/pages/projects/ProjectDetailPage';
import { KanbanBoardPage } from '../../src/pages/projects/KanbanBoardPage';
import { CalendarViewPage } from '../../src/pages/projects/CalendarViewPage';
import { GanttViewPage } from '../../src/pages/projects/GanttViewPage';
import { DependencyGraphPage } from '../../src/pages/projects/DependencyGraphPage';
import { CriticalPathPage } from '../../src/pages/projects/CriticalPathPage';
import { ListViewPage } from '../../src/pages/tasks/ListViewPage';
import { MyTasksPage } from '../../src/pages/tasks/MyTasksPage';
import { TeamsPage } from '../../src/pages/teams/TeamsPage';
import { SettingsPage } from '../../src/pages/settings/SettingsPage';
import { WorkflowsPage } from '../../src/pages/settings/WorkflowsPage';
import { LoginPage } from '../../src/pages/auth/LoginPage';
import { RegisterPage } from '../../src/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../../src/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../../src/pages/auth/ResetPasswordPage';
import { AcceptInvitePage } from '../../src/pages/auth/AcceptInvitePage';
import { AppLayout } from '../../src/components/layout/AppLayout';

const CASES = [
  ['login', '/login', <LoginPage />, false],
  ['register', '/register', <RegisterPage />, false],
  ['forgot-password', '/forgot-password', <ForgotPasswordPage />, false],
  ['reset-password', '/reset-password/abc', <ResetPasswordPage />, false],
  ['invite', '/invite/abc', <AcceptInvitePage />, true],
  ['dashboard', '/dashboard', <DashboardPage />, true],
  ['projects', '/projects', <ProjectsPage />, true],
  ['project-detail', '/projects/p1', <ProjectDetailPage />, true],
  ['board', '/projects/p1/board', <KanbanBoardPage />, true],
  ['calendar', '/projects/p1/calendar', <CalendarViewPage />, true],
  ['gantt', '/projects/p1/gantt', <GanttViewPage />, true],
  ['dependencies', '/projects/p1/dependencies', <DependencyGraphPage />, true],
  ['critical-path', '/projects/p1/critical-path', <CriticalPathPage />, true],
  ['list', '/tasks/list', <ListViewPage />, true],
  ['my-tasks', '/my-tasks', <MyTasksPage />, true],
  ['teams', '/teams', <TeamsPage />, true],
  ['settings', '/settings', <SettingsPage />, true],
  ['profile', '/profile', <SettingsPage defaultTab="profile" />, true],
  ['workflows', '/workflows', <WorkflowsPage />, true],
];

const GlobalApp = () => (
  <MemoryRouter initialEntries={['/dashboard']}>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
  </MemoryRouter>
);

const flush = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

const renderCase = async (name, path, element) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); };

  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  try {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <MemoryRouter initialEntries={[path]}>
                <Routes>
                  <Route path="/projects/:projectId/board" element={element} />
                  <Route path="/projects/:projectId/calendar" element={element} />
                  <Route path="/projects/:projectId/gantt" element={element} />
                  <Route path="/projects/:projectId/dependencies" element={element} />
                  <Route path="/projects/:projectId/critical-path" element={element} />
                  <Route path="/projects/:projectId" element={element} />
                  <Route path="/tasks/list" element={element} />
                  <Route path="/tasks" element={element} />
                  <Route path="/my-tasks" element={element} />
                  <Route path="/reset-password/:token" element={element} />
                  <Route path="/invite/:token" element={element} />
                  <Route path="*" element={element} />
                </Routes>
              </MemoryRouter>
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    await flush(120);
    const html = container.innerHTML;
    const text = container.textContent || '';
    root.unmount();
    return { name, ok: errors.length === 0, length: html.length, text: text.slice(0, 90), errors };
  } catch (error) {
    return { name, ok: false, length: 0, text: '', errors: [String(error && error.message ? error.message : error)] };
  } finally {
    console.error = originalError;
    container.remove();
  }
};


// ── Interaction checks ────────────────────────────────────────────────────────
// Render a page, drive the DOM and assert on what the user would actually see.
const mountPage = async (path, element) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const errors = [];
  const original = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const root = createRoot(container);
  root.render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route path="/tasks/list" element={element} />
                <Route path="/projects" element={element} />
                <Route path="/dashboard" element={element} />
                <Route path="/login" element={element} />
                <Route path="/projects/:projectId/board" element={element} />
                <Route path="*" element={element} />
              </Routes>
            </MemoryRouter>
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  await flush(140);
  return {
    container,
    text: () => document.body.textContent || '',
    findButton: (label) => Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim().includes(label)),
    click: async (el) => {
      if (!el) return false;
      el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await flush(140);
      return true;
    },
    unmount: () => { console.error = original; root.unmount(); container.remove(); },
    errors,
  };
};

const runInteractions = async () => {
  const checks = [];

  // Task drawer opens from a row, closes again, and the create dialog opens.
  {
    const view = await mountPage('/tasks/list', <ListViewPage />);
    const row = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').includes('Design the navigation shell'));
    await view.click(row);
    checks.push(['list: open task panel', view.text().includes('Subtasks') && view.text().includes('Comments')]);
    await view.click(document.querySelector('[aria-label="Close task panel"]'));
    checks.push(['list: close task panel', !document.querySelector('[aria-label^="Task:"]')]);
    await view.click(view.findButton('New task'));
    checks.push(['list: create-task dialog', Boolean(document.querySelector('#task-title, input[id*="title"]'))]);
    view.unmount();
  }

  {
    const view = await mountPage('/projects', <ProjectsPage />);
    await view.click(view.findButton('New project'));
    checks.push(['projects: create-project dialog', Boolean(document.querySelector('#project-name, input[id*="project-name"]'))]);
    view.unmount();
  }

  {
    const view = await mountPage('/projects/p1/board', <KanbanBoardPage />);
    const addButtons = Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').includes('Add task'));
    await view.click(addButtons[0]);
    checks.push(['board: inline task composer', Boolean(document.querySelector('textarea[aria-label="New task title"]'))]);
    view.unmount();
  }

  // Auth shell: aurora layers are present and the form sits in a glass card.
  {
    const view = await mountPage('/login', <LoginPage />);
    const aurora = document.querySelector('.aurora');
    const blobs = document.querySelectorAll('.aurora__blob');
    const glass = document.querySelector('.glass-card');
    const grid = document.querySelector('.aurora__grid');
    const grain = document.querySelector('.aurora__grain');
    const labelled = Boolean(document.querySelector('label[for="email"]'));
    checks.push(['auth: aurora background layers', Boolean(aurora) && blobs.length >= 3 && Boolean(grid) && Boolean(grain)]);
    checks.push(['auth: glass card + labelled form', Boolean(glass) && labelled]);
    view.unmount();
  }

  // Command palette opens with Ctrl+K inside the app shell.
  {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root.render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <MemoryRouter initialEntries={['/dashboard']}>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="*" element={<DashboardPage />} />
                  </Route>
                </Routes>
              </MemoryRouter>
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    await flush(160);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await flush(140);
    checks.push(['shell: command palette (Ctrl+K)', Boolean(document.querySelector('[aria-label="Search TaskFlow"]'))]);
    root.unmount();
    container.remove();
  }

  return checks;
};

const main = async () => {
  localStorage.setItem('accessToken', 'test-token');
  localStorage.setItem('activeWorkspaceId', 'w1');

  const results = [];
  const only = process.env.SMOKE_ONLY;
  for (const [name, path, element] of CASES) {
    if (only && !only.split(',').includes(name)) continue;
    process.stdout.write(`… ${name}
`);
    // eslint-disable-next-line no-await-in-loop
    results.push(await renderCase(name, path, element));
  }

  // Full shell (sidebar + top nav + routed page) in one pass.
  const shellContainer = document.createElement('div');
  document.body.appendChild(shellContainer);
  const shellErrors = [];
  const orig = console.error;
  console.error = (...args) => shellErrors.push(args.map(String).join(' '));
  const shellRoot = createRoot(shellContainer);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  shellRoot.render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <GlobalApp />
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  await flush(120);
  console.error = orig;
  const shellText = shellContainer.textContent || '';
  shellRoot.unmount();
  shellContainer.remove();

  const failed = results.filter((r) => !r.ok);
  results.forEach((r) => {
    const status = r.ok ? 'PASS' : 'FAIL';
    // eslint-disable-next-line no-console
    console.log(`${status}  ${r.name.padEnd(16)} chars=${String(r.length).padEnd(6)} ${r.text}`);
    r.errors.slice(0, 3).forEach((e) => console.log('        ! ' + e.split('\n')[0].slice(0, 220)));
  });
  console.log(`${shellErrors.length ? 'FAIL' : 'PASS'}  app-shell        chars=${shellText.length} :: ${shellText.slice(0, 80).replace(/\s+/g, ' ')}`);
  shellErrors.slice(0, 5).forEach((e) => console.log('        ! ' + e.split('\n')[0].slice(0, 220)));

  console.log(`\n${results.length - failed.length}/${results.length} page renders without console errors`);

  const checks = await runInteractions();
  checks.forEach(([name, ok]) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`));
  const failedChecks = checks.filter(([, ok]) => !ok).length;
  console.log(`${checks.length - failedChecks}/${checks.length} interaction checks passed`);
  process.exitCode = failed.length || shellErrors.length || failedChecks ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 50);
};

main();
