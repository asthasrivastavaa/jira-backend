import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Issue, IssueDocument } from '../issues/schemas/issue.schema.js';
import { Project, ProjectDocument } from '../projects/schemas/project.schema.js';
import { hasRole } from './roles.js';
import type { WorkspaceRole } from './schemas/workspace-member.schema.js';
import { WorkspacesService } from './workspaces.service.js';

/** Resolves "which workspace does this resource belong to?" and checks the caller's role in it. */
@Injectable()
export class AccessService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Issue.name) private issueModel: Model<IssueDocument>,
    private readonly workspaces: WorkspacesService,
  ) {}

  async workspaceIdOfProject(projectId: string) {
    const project = await this.projectModel.findById(projectId).select('workspaceId').lean();
    if (!project) throw new NotFoundException('Not found');
    return String(project.workspaceId);
  }

  async workspaceIdOfIssue(issueId: string) {
    const issue = await this.issueModel.findById(issueId).select('projectId').lean();
    if (!issue) throw new NotFoundException('Not found');
    return this.workspaceIdOfProject(String(issue.projectId));
  }

  /**
   * Not a member  -> 404 (we don't reveal that the resource exists)
   * Role too low  -> 403
   */
  async require(workspaceId: string, userId: string, min: WorkspaceRole) {
    const membership = await this.workspaces.getMembership(workspaceId, userId);
    if (!membership) throw new NotFoundException('Not found');
    if (!hasRole(membership.role, min)) {
      throw new ForbiddenException('You do not have permission to do this');
    }
    return membership;
  }
}
