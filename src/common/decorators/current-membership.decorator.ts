import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { WorkspaceMemberDocument } from '../../modules/workspaces/schemas/workspace-member.schema.js';

/**
 * The caller's membership in the workspace of the requested resource.
 * Set by ProjectMemberGuard, so it only exists on routes that use that guard.
 */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceMemberDocument => ctx.switchToHttp().getRequest().membership,
);
