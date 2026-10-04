import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { RedisService } from '../../infra/redis/redis.service.js';

export type OtpPurpose = 'verify' | 'reset' | 'email-change';

export const OTP_TTL_SEC = 60;
export const COOLDOWN_SEC = 60;
export const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly secret: string;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('OTP_SECRET');
  }

  private key(purpose: OtpPurpose, id: string) {
    return `otp:${purpose}:${id}`;
  }

  private hash(code: string) {
    return createHmac('sha256', this.secret).update(code).digest('hex');
  }

  /** Create + store a new code. Returns the plain code so the caller can email it. */
  async issue(purpose: OtpPurpose, id: string) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.redis.set(
      this.key(purpose, id),
      JSON.stringify({ hash: this.hash(code), attempts: 0 }),
      OTP_TTL_SEC,
    );
    return code;
  }

  /** Throws if the code is wrong/expired/locked. Resolves if it is right (and consumes it). */
  async verify(purpose: OtpPurpose, id: string, code: string) {
    const key = this.key(purpose, id);
    const raw = await this.redis.get(key);
    if (!raw) throw new BadRequestException('Code expired. Request a new one.');

    const entry = JSON.parse(raw) as { hash: string; attempts: number };
    const given = Buffer.from(this.hash(code), 'hex');
    const stored = Buffer.from(entry.hash, 'hex');

    if (given.length === stored.length && timingSafeEqual(given, stored)) {
      await this.redis.del(key);
      return;
    }

    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      await this.redis.del(key);
      throw new BadRequestException('Too many wrong attempts. Request a new code.');
    }
    const ttl = await this.redis.ttl(key);
    await this.redis.set(key, JSON.stringify(entry), ttl > 0 ? ttl : OTP_TTL_SEC);
    throw new BadRequestException(
      `Invalid code. ${MAX_ATTEMPTS - entry.attempts} attempts left.`,
    );
  }

  /** Claim the resend cooldown. Throws 429 with seconds left if it is still running. */
  async startCooldown(purpose: OtpPurpose, id: string) {
    const key = `otp:cooldown:${purpose}:${id}`;
    const acquired = await this.redis.setIfNotExists(key, '1', COOLDOWN_SEC);
    if (!acquired) {
      const left = Math.max(await this.redis.ttl(key), 1);
      throw new HttpException(
        { message: `Please wait ${left}s before requesting a new code`, retryAfter: left },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
  
  /** Claim the cooldown. Returns false (never throws) if it is still running. */
  tryStartCooldown(purpose: OtpPurpose, id: string) {
    return this.redis.setIfNotExists(`otp:cooldown:${purpose}:${id}`, '1', COOLDOWN_SEC);
  }

}
