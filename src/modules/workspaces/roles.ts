import type { WorkspaceRole } from './schemas/workspace-member.schema.js';

// viewer < member < admin < owner
export const ROLE_RANK: Record<WorkspaceRole, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export const hasRole = (role: WorkspaceRole, min: WorkspaceRole) => ROLE_RANK[role] >= ROLE_RANK[min];
