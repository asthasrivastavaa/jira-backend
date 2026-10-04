import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { AccessService } from '../../modules/workspaces/access.service.js';
import type { WorkspaceRole } from '../../modules/workspaces/schemas/workspace-member.schema.js';

/**
 * For routes with a :workspaceId param. Runs AFTER the global JwtAuthGuard (so req.user exists).
 * Membership + the minimum role from @Roles() are checked here, before the handler runs.
 */
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const workspaceId = req.params?.workspaceId;
    // guards run before pipes, so an invalid id must be rejected here
    if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) throw new NotFoundException('Not found');

    const min = this.reflector.getAllAndOverride<WorkspaceRole>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? 'viewer';
    req.membership = await this.access.require(workspaceId, req.user.id, min);
    return true;
  }
}
