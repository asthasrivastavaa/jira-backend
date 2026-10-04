import { ForbiddenException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { MailService } from '../../infra/mail/mail.service.js';
import { UsersService } from '../users/user.service.js';
import { Invite, InviteDocument } from './schemas/invite.schema.js';
import type { InviteRole } from './schemas/invite.schema.js';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema.js';
import { WorkspaceMember, WorkspaceMemberDocument } from './schemas/workspace-member.schema.js';
import { WorkspacesService } from './workspaces.service.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The raw token only ever travels by email. We store its hash, like a password.
// A fast hash is fine here: the token is 256 bits of randomness, not a guessable secret.
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
};

export type InviteResult = { email: string; status: 'sent' | 'resent' | 'already_member' };

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);
  private readonly appUrl: string;

  constructor(
    @InjectModel(Invite.name) private inviteModel: Model<InviteDocument>,
    @InjectModel(Workspace.name) private workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(WorkspaceMember.name) private memberModel: Model<WorkspaceMemberDocument>,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly workspaces: WorkspacesService,
    config: ConfigService,
  ) {
    this.appUrl = config.getOrThrow<string>('APP_URL').replace(/\/$/, '');
  }

  private sendEmail(invite: InviteDocument, token: string, workspaceName: string, inviterName: string) {
    // not awaited: the invite exists even if the mail server hiccups, and the admin can resend
    this.mail
      .sendInvite(invite.email, {
        workspaceName,
        inviterName,
        role: invite.role,
        link: `${this.appUrl}/invite/${token}`,
      })
      .catch((err) => this.logger.error(err));
  }

  async create(workspaceId: string, actorId: string, emails: string[], role: InviteRole) {
    await this.workspaces.requireRole(workspaceId, actorId, ['owner', 'admin']);
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');
    const actor = await this.users.findById(actorId);
    const results: InviteResult[] = [];

    for (const email of emails) {
      const existingUser = await this.users.findByEmail(email);
      if (existingUser && (await this.workspaces.getMembership(workspaceId, existingUser.id))) {
        results.push({ email, status: 'already_member' });
        continue;
      }

      const { token, tokenHash } = newToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      const pending = await this.inviteModel.findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        email,
        status: 'pending',
      });

      let invite: InviteDocument;
      if (pending) {
        // same person invited again: refresh the existing invite instead of stacking duplicates
        pending.tokenHash = tokenHash;
        pending.expiresAt = expiresAt;
        pending.role = role;
        invite = await pending.save();
        results.push({ email, status: 'resent' });
      } else {
        invite = await this.inviteModel.create({
          workspaceId: new Types.ObjectId(workspaceId),
          email,
          role,
          tokenHash,
          expiresAt,
          invitedById: new Types.ObjectId(actorId),
        });
        results.push({ email, status: 'sent' });
      }
      this.sendEmail(invite, token, workspace.name, actor?.name ?? 'A teammate');
    }
    return results;
  }

  async list(workspaceId: string, actorId: string) {
    await this.workspaces.requireRole(workspaceId, actorId, ['owner', 'admin']);
    const oid = new Types.ObjectId(workspaceId);
    // expiry is checked lazily: no cron job needed until Phase 5
    await this.inviteModel.updateMany(
      { workspaceId: oid, status: 'pending', expiresAt: { $lt: new Date() } },
      { status: 'expired' },
    );
    const invites = await this.inviteModel
      .find({ workspaceId: oid, status: { $in: ['pending', 'expired'] } })
      .sort({ createdAt: -1 });
    return invites.map((i) => ({
      id: i.id as string,
      email: i.email,
      role: i.role,
      status: i.status,
      expiresAt: i.expiresAt,
      createdAt: i.get('createdAt') as Date,
    }));
  }

  async revoke(workspaceId: string, inviteId: string, actorId: string) {
    await this.workspaces.requireRole(workspaceId, actorId, ['owner', 'admin']);
    const res = await this.inviteModel.updateOne(
      { _id: inviteId, workspaceId: new Types.ObjectId(workspaceId), status: { $in: ['pending', 'expired'] } },
      { status: 'revoked' },
    );
    if (res.matchedCount === 0) throw new NotFoundException('Invite not found');
    return { id: inviteId };
  }

  async resend(workspaceId: string, inviteId: string, actorId: string) {
    await this.workspaces.requireRole(workspaceId, actorId, ['owner', 'admin']);
    const invite = await this.inviteModel.findOne({
      _id: inviteId,
      workspaceId: new Types.ObjectId(workspaceId),
      status: { $in: ['pending', 'expired'] },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    const workspace = await this.workspaceModel.findById(workspaceId);
    const actor = await this.users.findById(actorId);

    const { token, tokenHash } = newToken();
    invite.tokenHash = tokenHash; // the old link stops working
    invite.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    invite.status = 'pending';
    await invite.save();
    this.sendEmail(invite, token, workspace?.name ?? 'a workspace', actor?.name ?? 'A teammate');
    return { id: inviteId };
  }

  /** The one place that decides whether an invite link may still be used. */
  async getValid(token: string): Promise<InviteDocument> {
    const invite = await this.inviteModel.findOne({ tokenHash: hashToken(token) });
    if (!invite || invite.status === 'revoked' || invite.status === 'accepted') {
      throw new GoneException('This invite is no longer valid');
    }
    if (invite.status === 'expired' || invite.expiresAt.getTime() < Date.now()) {
      if (invite.status !== 'expired') {
        invite.status = 'expired';
        await invite.save();
      }
      throw new GoneException('This invite has expired');
    }
    return invite;
  }

  async preview(token: string) {
    const invite = await this.getValid(token);
    const workspace = await this.workspaceModel.findById(invite.workspaceId);
    if (!workspace) throw new GoneException('This invite is no longer valid');
    const hasAccount = !!(await this.users.findByEmail(invite.email));
    return { workspaceName: workspace.name, email: invite.email, role: invite.role, hasAccount };
  }

  /** Logged-in user accepts: the invite's email must be THEIR email. */
  async accept(token: string, userId: string) {
    const invite = await this.getValid(token);
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.email !== invite.email) {
      throw new ForbiddenException(`This invite was sent to ${invite.email}. Log in with that account to accept it.`);
    }
    return this.completeAcceptance(invite, userId);
  }

  /** Creates the membership and burns the invite (single use). Also used by register-with-invite. */
  async completeAcceptance(invite: InviteDocument, userId: string) {
    try {
      await this.memberModel.create({
        workspaceId: invite.workspaceId,
        userId: new Types.ObjectId(userId),
        role: invite.role,
      });
    } catch (err: any) {
      if (err?.code !== 11000) throw err; // already a member: still fine
    }
    invite.status = 'accepted';
    await invite.save();

    const workspace = await this.workspaceModel.findById(invite.workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');
    return {
      id: workspace.id as string,
      name: workspace.name,
      slug: workspace.slug,
      role: invite.role,
      onboardingCompleted: workspace.onboardingCompleted,
    };
  }
}
