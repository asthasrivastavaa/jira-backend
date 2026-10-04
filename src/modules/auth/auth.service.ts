import { BadRequestException, Logger, ConflictException, Injectable,UnauthorizedException, ForbiddenException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { MailService } from '../../infra/mail/mail.service.js';
import { UsersService } from '../users/user.service.js';
import { OtpService, COOLDOWN_SEC, OTP_TTL_SEC } from './otp.service.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

import { RegisterDto } from './dto/register.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { TokensService } from './tokens.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { InvitesService } from '../workspaces/invites.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { RequestEmailChangeDto } from './dto/change-email.dto.js';
import { RegisterWithInviteDto } from './dto/register-with-invite.dto.js';
// Compared against when the email is unknown, so "no such user" takes as long as "wrong password"
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
      private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly tokens: TokensService,
    private readonly workspaces: WorkspacesService,
    private readonly invites: InvitesService,
    private readonly redis: RedisService,
  ) {}

  private async sendVerifyOtp(email: string) {
    await this.otp.startCooldown('verify', email);
    const code = await this.otp.issue('verify', email);
    await this.mail.sendOtp(email, code, 'verify');
  }
  

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const existing = await this.users.findByEmail(dto.email);

    if (existing?.isEmailVerified) {
      throw new ConflictException('An account with this email already exists');
    }

    if (existing) {
      await this.users.updateUnverified(existing.id, { name: dto.name, passwordHash });
    } else {
      await this.users.create({ name: dto.name, email: dto.email, passwordHash });
    }

    await this.sendVerifyOtp(dto.email);
       return { email: dto.email, resendIn: COOLDOWN_SEC, expiresIn: OTP_TTL_SEC };

  }
    async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return { user: { id: user.id, name: user.name, email: user.email }, workspaces: await this.workspaces.listForUser(user.id) };
  }


  async verifyOtp(dto: VerifyOtpDto) {
    await this.otp.verify('verify', dto.email, dto.code);
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Invalid code');
    await this.users.markEmailVerified(user.id);
       const tokens = await this.tokens.issue(user.id);
    return { verified: true, tokens };

  }

  async resendOtp(email: string) {
    const user = await this.users.findByEmail(email);
    if (user && !user.isEmailVerified) {
      await this.sendVerifyOtp(email);
    }
       return { sent: true, resendIn: COOLDOWN_SEC, expiresIn: OTP_TTL_SEC };

  }
    async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');
    if (!user.isEmailVerified) {
      throw new ForbiddenException('Please verify your email before logging in');
    }
    const tokens = await this.tokens.issue(user.id);
    return { user: { id: user.id, name: user.name, email: user.email }, tokens };
  }

  refresh(refreshToken: string) {
    return this.tokens.rotate(refreshToken);
  }

  logout(refreshToken?: string) {
    return this.tokens.revoke(refreshToken);
  }


    async forgotPassword(email: string) {
    const allowed = await this.otp.tryStartCooldown('reset', email);
    const user = await this.users.findByEmail(email);
    if (allowed && user?.isEmailVerified) {
      const code = await this.otp.issue('reset', email);
      // not awaited: a known email must respond as fast as an unknown one
      this.mail.sendOtp(email, code, 'reset').catch((err) => this.logger.error(err));
    }
    return { sent: true, resendIn: COOLDOWN_SEC, expiresIn: OTP_TTL_SEC };
  }

  async resetPassword(dto: ResetPasswordDto) {
    await this.otp.verify('reset', dto.email, dto.code);
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Invalid code');
    await this.users.updatePassword(user.id, await bcrypt.hash(dto.newPassword, 10));
    await this.tokens.revokeAll(user.id);
    return { reset: true };
  }

  // ---- change email (Phase 2 exam) ----
  // The OTP is stored under the USER id (purpose 'email-change'); the new address waits in Redis next to it.

  private pendingEmailKey(userId: string) {
    return `email-change:pending:${userId}`;
  }

  async requestEmailChange(userId: string, dto: RequestEmailChangeDto) {
    const current = await this.users.findById(userId);
    if (!current) throw new UnauthorizedException('User no longer exists');

    const withHash = await this.users.findByEmailWithPassword(current.email);
    const ok = await bcrypt.compare(dto.password, withHash?.passwordHash ?? DUMMY_HASH);
    if (!ok) throw new UnauthorizedException('Your password is incorrect');

    if (dto.newEmail === current.email) throw new BadRequestException('That is already your email address');
    if (await this.users.findByEmail(dto.newEmail)) throw new ConflictException('That email is already in use');

    await this.otp.startCooldown('email-change', userId); // 60 s between codes, 429 with seconds left
    await this.redis.set(this.pendingEmailKey(userId), dto.newEmail, OTP_TTL_SEC);
    const code = await this.otp.issue('email-change', userId);
    await this.mail.sendOtp(dto.newEmail, code, 'email-change'); // proves the NEW address is reachable
    return { email: dto.newEmail, resendIn: COOLDOWN_SEC, expiresIn: OTP_TTL_SEC };
  }

  async confirmEmailChange(userId: string, code: string) {
    await this.otp.verify('email-change', userId, code);

    const pending = await this.redis.get(this.pendingEmailKey(userId));
    if (!pending) throw new BadRequestException('This request has expired. Start again.');

    await this.users.updateEmail(userId, pending); // 409 if the address was taken in the meantime
    await this.redis.del(this.pendingEmailKey(userId));

    // the account's identity changed: end every session, then keep THIS device signed in
    await this.tokens.revokeAll(userId);
    const tokens = await this.tokens.issue(userId);
    return { email: pending, tokens };
  }

  async registerWithInvite(dto: RegisterWithInviteDto) {
    const invite = await this.invites.getValid(dto.token);
    const existing = await this.users.findByEmail(invite.email);
    if (existing?.isEmailVerified) {
      throw new ConflictException('An account already exists for this email. Please log in to accept the invite.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    let userId: string;
    if (existing) {
      // registered earlier but never verified: the invite link proves the email, so finish the account
      await this.users.updateUnverified(existing.id, { name: dto.name, passwordHash });
      userId = existing.id;
    } else {
      const created = await this.users.create({ name: dto.name, email: invite.email, passwordHash });
      userId = created.id;
    }
    await this.users.markEmailVerified(userId);

    const workspace = await this.invites.completeAcceptance(invite, userId);
    const tokens = await this.tokens.issue(userId);
    return { user: { id: userId, name: dto.name, email: invite.email }, workspace, tokens };
  }

}
