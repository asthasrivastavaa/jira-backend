import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../../infra/redis/redis.service.js';
import { ACCESS_TTL_SEC, REFRESH_TTL_SEC } from './auth.constants.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokensService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private sessionKey(userId: string, jti: string) {
    return `refresh:${userId}:${jti}`;
  }

  private setKey(userId: string) {
    return `sessions:${userId}`;
  }

  async issue(userId: string): Promise<TokenPair> {
    const jti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ sub: userId }, { secret: this.accessSecret, expiresIn: ACCESS_TTL_SEC }),
      this.jwt.signAsync({ sub: userId, jti }, { secret: this.refreshSecret, expiresIn: REFRESH_TTL_SEC }),
    ]);
    await this.redis.set(this.sessionKey(userId, jti), '1', REFRESH_TTL_SEC);
    await this.redis.sadd(this.setKey(userId), jti);
    await this.redis.expire(this.setKey(userId), REFRESH_TTL_SEC);
    return { accessToken, refreshToken };
  }

  private async readRefresh(token: string) {
    try {
      return await this.jwt.verifyAsync<{ sub: string; jti: string }>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /** Swap a refresh token for a new pair. A token that was already used = reuse → revoke everything. */
  async rotate(token: string): Promise<TokenPair> {
    const { sub, jti } = await this.readRefresh(token);
    const removed = await this.redis.del(this.sessionKey(sub, jti));
    if (removed === 0) {
      await this.revokeAll(sub);
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    await this.redis.srem(this.setKey(sub), jti);
    return this.issue(sub);
  }

  async revoke(token?: string) {
    if (!token) return;
    try {
      const { sub, jti } = await this.readRefresh(token);
      await this.redis.del(this.sessionKey(sub, jti));
      await this.redis.srem(this.setKey(sub), jti);
    } catch {
      // logging out with a bad or expired token is still a successful logout
    }
  }

async verifyAccess(token: string) {
    try {
      return await this.jwt.verifyAsync<{ sub: string }>(token, { secret: this.accessSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }


  async revokeAll(userId: string) {
    const ids = await this.redis.smembers(this.setKey(userId));
    await this.redis.del(...ids.map((id) => this.sessionKey(userId, id)), this.setKey(userId));
  }
}
