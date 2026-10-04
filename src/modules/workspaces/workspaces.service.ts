import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema.js';
import { WorkspaceMember, WorkspaceMemberDocument, WorkspaceRole } from './schemas/workspace-member.schema.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { RESERVED_SLUGS } from './workspace.constant.js';
import { Invite, InviteDocument } from './schemas/invite.schema.js';
import type { InviteRole } from './schemas/invite.schema.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { UsersService } from '../users/user.service.js';
import { Issue, IssueDocument } from '../issues/schemas/issue.schema.js';
import { Project, ProjectDocument } from '../projects/schemas/project.schema.js';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name) private workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(WorkspaceMember.name) private memberModel: Model<WorkspaceMemberDocument>,
    @InjectModel(Invite.name) private inviteModel: Model<InviteDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Issue.name) private issueModel: Model<IssueDocument>,
    private readonly users: UsersService,
  ) {}

  /** Membership + role check shared by members and invites. Non-members get 404, too-low roles 403. */
  async requireRole(workspaceId: string, userId: string, roles: WorkspaceRole[]) {
    const membership = await this.getMembership(workspaceId, userId);
    if (!membership) throw new NotFoundException('Workspace not found');
    if (!roles.includes(membership.role)) {
      throw new ForbiddenException('You do not have permission to do this');
    }
    return membership;
  }

  private toView(ws: WorkspaceDocument, role: WorkspaceRole) {
    return { id: ws.id as string, name: ws.name, slug: ws.slug, role, onboardingCompleted: ws.onboardingCompleted };
  }

  getMembership(workspaceId: string, userId: string) {
    return this.memberModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
    });
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    let workspace: WorkspaceDocument;
    try {
      workspace = await this.workspaceModel.create({
        name: dto.name,
        slug: dto.slug,
        ownerId: new Types.ObjectId(userId),
      });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('This URL is already taken');
      throw err;
    }
    try {
      await this.memberModel.create({
        workspaceId: workspace._id,
        userId: new Types.ObjectId(userId),
        role: 'owner',
      });
    } catch (err) {
      await this.workspaceModel.deleteOne({ _id: workspace._id }); // no transactions yet: undo the first write
      throw err;
    }
    return this.toView(workspace, 'owner');
  }

  async listForUser(userId: string) {
    const memberships = await this.memberModel.find({ userId: new Types.ObjectId(userId) }).lean();
    if (!memberships.length) return [];
    const workspaces = await this.workspaceModel
      .find({ _id: { $in: memberships.map((m) => m.workspaceId) } })
      .sort({ createdAt: 1 });
    const roleById = new Map(memberships.map((m) => [String(m.workspaceId), m.role]));
    return workspaces.map((ws) => this.toView(ws, roleById.get(ws.id as string)!));
  }

  async findBySlugForUser(slug: string, userId: string) {
    const ws = await this.workspaceModel.findOne({ slug: slug.toLowerCase() });
    const membership = ws ? await this.getMembership(ws.id as string, userId) : null;
    if (!ws || !membership) throw new NotFoundException('Workspace not found'); // same answer for "missing" and "not yours"
    return this.toView(ws, membership.role);
  }

  async isSlugAvailable(slug: string) {
    if (!slug || RESERVED_SLUGS.includes(slug)) return false;
    return !(await this.workspaceModel.exists({ slug }));
  }

  async completeOnboarding(workspaceId: string, userId: string) {
    const membership = await this.getMembership(workspaceId, userId);
    if (!membership) throw new NotFoundException('Workspace not found');
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      throw new ForbiddenException('Only an owner or admin can do this');
    }
    await this.workspaceModel.updateOne({ _id: workspaceId }, { onboardingCompleted: true });
    return { completed: true };
  }

  async listMembers(workspaceId: string, userId: string) {
    await this.requireRole(workspaceId, userId, ['owner', 'admin', 'member', 'viewer']);
    const members = await this.memberModel.find({ workspaceId: new Types.ObjectId(workspaceId) }).lean();
    const users = await this.users.findByIds(members.map((m) => String(m.userId)));
    const byId = new Map(users.map((u) => [u.id as string, u]));
    const rank: Record<WorkspaceRole, number> = { owner: 0, admin: 1, member: 2, viewer: 3 };

    return members
      .map((m) => {
        const u = byId.get(String(m.userId));
        return {
          userId: String(m.userId),
          name: u?.name ?? 'Unknown user',
          email: u?.email ?? '',
          role: m.role,
          joinedAt: (m as unknown as { createdAt: Date }).createdAt,
        };
      })
      .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));
  }

  async changeRole(workspaceId: string, targetUserId: string, role: InviteRole, actorId: string) {
    await this.requireRole(workspaceId, actorId, ['owner', 'admin']);
    const target = await this.getMembership(workspaceId, targetUserId);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') {
      throw new ForbiddenException("The owner's role can only change by transferring ownership");
    }
    target.role = role;
    await target.save();
    return { userId: targetUserId, role };
  }

  async removeMember(workspaceId: string, targetUserId: string, actorId: string) {
    const actor = await this.requireRole(workspaceId, actorId, ['owner', 'admin', 'member', 'viewer']);
    const target = await this.getMembership(workspaceId, targetUserId);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') {
      throw new ForbiddenException('The owner cannot be removed. Transfer ownership first.');
    }
    const isSelf = actorId === targetUserId; // anyone may leave a workspace
    if (!isSelf && actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException('You do not have permission to do this');
    }
    await target.deleteOne();
    return { userId: targetUserId };
  }

  // ---- settings (2.8) ----

  /** Rename and/or change the URL slug. Admins and owners. */
  async update(workspaceId: string, actorId: string, dto: UpdateWorkspaceDto) {
    const actor = await this.requireRole(workspaceId, actorId, ['owner', 'admin']);
    const patch: { name?: string; slug?: string } = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.slug !== undefined) patch.slug = dto.slug;

    try {
      const ws = await this.workspaceModel.findByIdAndUpdate(workspaceId, patch, { new: true });
      if (!ws) throw new NotFoundException('Workspace not found');
      return this.toView(ws, actor.role);
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('This URL is already taken');
      throw err;
    }
  }

  /** Owner hands the workspace to an existing admin; the old owner becomes an admin. */
  async transferOwnership(workspaceId: string, actorId: string, targetUserId: string) {
    const actor = await this.requireRole(workspaceId, actorId, ['owner']);
    if (targetUserId === actorId) throw new BadRequestException('You already own this workspace');

    const target = await this.getMembership(workspaceId, targetUserId);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role !== 'admin') {
      throw new BadRequestException('Ownership can only be transferred to an admin. Promote them to admin first.');
    }

    // no transactions yet: promote first, and undo it if the next write fails,
    // so the workspace never ends up with zero owners or two
    target.role = 'owner';
    await target.save();
    try {
      actor.role = 'admin';
      await actor.save();
      await this.workspaceModel.updateOne({ _id: workspaceId }, { ownerId: new Types.ObjectId(targetUserId) });
    } catch (err) {
      target.role = 'admin';
      await target.save();
      throw err;
    }
    return { ownerId: targetUserId };
  }

  /** Owner only. Deletes everything inside, children first, so a crash never leaves orphans pointing at nothing. */
  async remove(workspaceId: string, actorId: string) {
    await this.requireRole(workspaceId, actorId, ['owner']);
    const oid = new Types.ObjectId(workspaceId);

    const projects = await this.projectModel.find({ workspaceId: oid }).select('_id').lean();
    await this.issueModel.deleteMany({ projectId: { $in: projects.map((p) => p._id) } });
    await this.projectModel.deleteMany({ workspaceId: oid });
    await this.inviteModel.deleteMany({ workspaceId: oid });
    await this.memberModel.deleteMany({ workspaceId: oid });
    await this.workspaceModel.deleteOne({ _id: oid });
    return { id: workspaceId };
  }
}
