import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ToastProvider } from './components/ui/Toast';
import { FullPageLoader } from './components/ui/Spinner';
import { AppLayout } from './components/layout/AppLayout';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AcceptInvitePage } from './pages/auth/AcceptInvitePage';

// App pages
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage';
const KanbanBoardPage = lazy(() => import('./pages/projects/KanbanBoardPage').then((m) => ({ default: m.KanbanBoardPage })));
// The interactive visualisations pull in heavier libraries (@xyflow/react,
// date maths), so they are loaded on demand instead of on first paint.
const CalendarViewPage = lazy(() => import('./pages/projects/CalendarViewPage').then((m) => ({ default: m.CalendarViewPage })));
const GanttViewPage = lazy(() => import('./pages/projects/GanttViewPage').then((m) => ({ default: m.GanttViewPage })));
const DependencyGraphPage = lazy(() => import('./pages/projects/DependencyGraphPage').then((m) => ({ default: m.DependencyGraphPage })));
const CriticalPathPage = lazy(() => import('./pages/projects/CriticalPathPage').then((m) => ({ default: m.CriticalPathPage })));
import { MyTasksPage } from './pages/tasks/MyTasksPage';
import { ListViewPage } from './pages/tasks/ListViewPage';
import { TeamsPage } from './pages/teams/TeamsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { WorkflowsPage } from './pages/settings/WorkflowsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Only allow same-app relative redirects after sign-in. */
const safeRedirect = (value, fallback = '/dashboard') => (
  value && value.startsWith('/') && !value.startsWith('//') ? value : fallback
);

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const PublicRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

const AppRoutes = () => (
  <Routes>
    <Route element={<PublicRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    </Route>

    {/* Invitation page — reachable signed in or signed out */}
    <Route path="/invite/:token" element={<AcceptInvitePage />} />

    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/my-tasks" element={<MyTasksPage />} />
        <Route path="/tasks" element={<ListViewPage />} />
        <Route path="/tasks/list" element={<ListViewPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/projects/:projectId/board" element={<KanbanBoardPage />} />
        <Route path="/projects/:projectId/calendar" element={<CalendarViewPage />} />
        <Route path="/projects/:projectId/gantt" element={<GanttViewPage />} />
        <Route path="/projects/:projectId/dependencies" element={<DependencyGraphPage />} />
        <Route path="/projects/:projectId/critical-path" element={<CriticalPathPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/settings" element={<SettingsPage defaultTab="workspace" />} />
        <Route path="/profile" element={<SettingsPage defaultTab="profile" />} />
      </Route>
    </Route>

    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to={safeRedirect('/dashboard')} replace />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <Suspense fallback={<FullPageLoader />}>
                <AppRoutes />
              </Suspense>
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
