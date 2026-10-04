import { SetMetadata } from '@nestjs/common';

export const SCOPE_KEY = 'accessScope';

export interface AccessScope {
  /** what the route parameter identifies */
  kind: 'project' | 'issue';
  /** name of the route parameter, e.g. 'projectId' or 'id' */
  param: string;
}

/**
 * Tells ProjectMemberGuard how to find the workspace:
 *   @Scope('project', 'projectId')  -> /projects/:projectId/issues
 *   @Scope('project', 'id')         -> /projects/:id
 *   @Scope('issue', 'id')           -> /issues/:id
 */
export const Scope = (kind: AccessScope['kind'], param: string) => SetMetadata(SCOPE_KEY, { kind, param });
