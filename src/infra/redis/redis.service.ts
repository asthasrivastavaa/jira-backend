import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSec?: number) {
    if (ttlSec) await this.client.set(key, value, 'EX', ttlSec);
    else await this.client.set(key, value);
  }

  async setIfNotExists(key: string, value: string, ttlSec: number) {
    const res = await this.client.set(key, value, 'EX', ttlSec, 'NX');
    return res === 'OK';
  }

  incr(key: string) {
    return this.client.incr(key);
  }

  expire(key: string, ttlSec: number) {
    return this.client.expire(key, ttlSec);
  }

  ttl(key: string) {
    return this.client.ttl(key);
  }

  del(...keys: string[]) {
    return this.client.del(...keys);
  }

  sadd(key: string, ...members: string[]) {
    return this.client.sadd(key, ...members);
  }

  srem(key: string, ...members: string[]) {
    return this.client.srem(key, ...members);
  }

  smembers(key: string) {
    return this.client.smembers(key);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
