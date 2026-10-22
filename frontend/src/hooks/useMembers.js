import { useQuery } from '@tanstack/react-query';
import { workspacesApi, workspaceKeys } from '../lib/taskApi';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * Cached workspace member list, used by assignee pickers and project member
 * selectors. One request per workspace thanks to react-query caching.
 */
export const useMembers = () => {
  const { activeWorkspaceId } = useWorkspace();

  const { data, isLoading } = useQuery({
    queryKey: workspaceKeys.members(activeWorkspaceId),
    queryFn: () => workspacesApi.members(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId),
    staleTime: 60_000,
  });

  const members = data || [];

  return {
    members,
    users: members.map((m) => ({ ...m.user, membershipId: m._id, role: m.role })).filter((u) => u?._id),
    isLoading,
  };
};
