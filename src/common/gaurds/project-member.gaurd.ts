import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { SCOPE_KEY } from '../decorators/scope.decorator.js';
import type { AccessScope } from '../decorators/scope.decorator.js';
import { AccessService } from '../../modules/workspaces/access.service.js';
import type { WorkspaceRole } from '../../modules/workspaces/schemas/workspace-member.schema.js';

/**
 * For routes that identify a project or an issue by id (/projects/:id, /issues/:id, /projects/:projectId/...).
 * It looks up which workspace the resource belongs to, then checks the caller's membership and role there.
 * That is what stops user B (not in workspace A) from reading an issue just by guessing its id.
 */
@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const targets = [context.getHandler(), context.getClass()];
    const scope = this.reflector.getAllAndOverride<AccessScope>(SCOPE_KEY, targets) ?? {
      kind: 'project',
      param: 'projectId',
    };
    const id = req.params?.[scope.param];
    if (!id || !Types.ObjectId.isValid(id)) throw new NotFoundException('Not found');

    const workspaceId =
      scope.kind === 'project'
        ? await this.access.workspaceIdOfProject(id)
        : await this.access.workspaceIdOfIssue(id);

    const min = this.reflector.getAllAndOverride<WorkspaceRole>(ROLES_KEY, targets) ?? 'viewer';
    req.membership = await this.access.require(workspaceId, req.user.id, min);
    return true;
  }
}
