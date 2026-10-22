import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { workspacesApi, workspaceKeys } from '../lib/taskApi';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);
const STORAGE_KEY = 'activeWorkspaceId';

export const WorkspaceProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => localStorage.getItem(STORAGE_KEY) || null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: workspaceKeys.all,
    queryFn: workspacesApi.list,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const workspaces = useMemo(() => data || [], [data]);

  // Keep the selected workspace valid; default to the first one available.
  useEffect(() => {
    if (!workspaces.length) return;
    const valid = workspaces.find((w) => w._id === activeWorkspaceId);
    if (!valid) {
      const first = workspaces[0];
      setActiveWorkspaceId(first._id);
      localStorage.setItem(STORAGE_KEY, first._id);
    }
  }, [workspaces, activeWorkspaceId]);

  const switchWorkspace = useCallback((id) => {
    setActiveWorkspaceId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId) || null;
  const role = activeWorkspace?.role || 'member';

  const value = useMemo(() => ({
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    activeRole: role,
    canManageWorkspace: role === 'owner' || role === 'admin',
    isOwner: role === 'owner',
    switchWorkspace,
    isLoading,
    refetch,
  }), [workspaces, activeWorkspace, activeWorkspaceId, role, switchWorkspace, isLoading, refetch]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
};
