import { SetMetadata } from '@nestjs/common';
import type { WorkspaceRole } from '../../modules/workspaces/schemas/workspace-member.schema.js';

export const ROLES_KEY = 'minRole';

/**
 * Minimum role needed for a route: @Roles('admin') means admin OR owner.
 * Routes without @Roles() are open to every member (including viewers).
 */
export const Roles = (minRole: WorkspaceRole) => SetMetadata(ROLES_KEY, minRole);
