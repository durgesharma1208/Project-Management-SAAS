import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

export const WorkspaceProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(
    () => localStorage.getItem('activeWorkspaceId') || null
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get('/workspaces').then((r) => r.data.data.workspaces),
    enabled: isAuthenticated,
  });

  const workspaces = data || [];

  // Auto-select first workspace if none selected or saved one is gone
  useEffect(() => {
    if (workspaces.length === 0) return;
    const valid = workspaces.find((w) => w._id === activeWorkspaceId);
    if (!valid) {
      const first = workspaces[0];
      setActiveWorkspaceId(first._id);
      localStorage.setItem('activeWorkspaceId', first._id);
    }
  }, [workspaces, activeWorkspaceId]);

  const switchWorkspace = useCallback((id) => {
    setActiveWorkspaceId(id);
    localStorage.setItem('activeWorkspaceId', id);
  }, []);

  const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId) || null;

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      switchWorkspace,
      isLoading,
      refetch,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
};
