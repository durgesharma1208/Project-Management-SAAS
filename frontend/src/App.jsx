import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
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
import { KanbanBoardPage } from './pages/projects/KanbanBoardPage';
import { MyTasksPage } from './pages/tasks/MyTasksPage';
import { ListViewPage } from './pages/tasks/ListViewPage';
import { TeamsPage } from './pages/teams/TeamsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { WorkflowsPage } from './pages/settings/WorkflowsPage';
import { CalendarViewPage } from './pages/projects/CalendarViewPage';
import { GanttViewPage } from './pages/projects/GanttViewPage';
import { DependencyGraphPage } from './pages/projects/DependencyGraphPage';
import { CriticalPathPage } from './pages/projects/CriticalPathPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected route wrapper
const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
};

// Public-only route (redirect authenticated users away)
const PublicRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

// Kanban full-page layout (no sidebar/topnav chrome)
const KanbanLayout = () => (
  <div className="flex h-screen overflow-hidden bg-surface-50">
    <KanbanBoardPage />
  </div>
);

const AppRoutes = () => (
  <Routes>
    {/* Public routes */}
    <Route element={<PublicRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    </Route>

    {/* Invitation page — accessible while authenticated */}
    <Route path="/invite/:token" element={<AcceptInvitePage />} />

    {/* Protected app routes */}
    <Route element={<ProtectedRoute />}>
      {/* Standard app shell routes */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/my-tasks" element={<MyTasksPage />} />
        <Route path="/tasks/list" element={<ListViewPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/projects/:projectId/calendar" element={<CalendarViewPage />} />
        <Route path="/projects/:projectId/gantt" element={<GanttViewPage />} />
        <Route path="/projects/:projectId/dependencies" element={<DependencyGraphPage />} />
        <Route path="/projects/:projectId/critical-path" element={<CriticalPathPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<SettingsPage />} />
      </Route>

      {/* Kanban has its own full-height layout without sidebar */}
      <Route path="/projects/:projectId/board" element={<KanbanLayout />} />
    </Route>

    {/* Default redirect */}
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WorkspaceProvider>
            <AppRoutes />
          </WorkspaceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
