import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ErrorManager } from '../../utils/error.manager';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly context = 'CacheService';
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    });
  }

  onModuleDestroy() {
    this.client.quit();
  }

  async set(key: string, value: unknown, ttlInSeconds: number): Promise<void> {
    const strValue = JSON.stringify(value);
    if (ttlInSeconds && ttlInSeconds > 0) {
      await this.client.set(key, strValue, 'EX', ttlInSeconds); // 'EX' sets an expiration time
    } else {
      await this.client.set(key, strValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      // Usar reviver para convertir ISO strings de vuelta a Date objects
      return JSON.parse(raw, this.dateReviver) as T;
    } catch (error) {
      // const duration = Date.now() - startTime;
      //       this.logger.error(
      //         `Redis cache error, trying get data: ${error.message}`,
      //         error.stack,
      //         this.context,
      //         { duration },
      //       );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  /**
   * Reviver para JSON.parse que convierte ISO date strings a Date objects
   * Identifica strings que parecen ISO 8601 y los convierte a Date
   */
  private dateReviver = (key: string, value: unknown): unknown => {
    if (typeof value === 'string') {
      // Patrón ISO 8601: YYYY-MM-DDTHH:mm:ss.sssZ
      const isoDatePattern =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      if (isoDatePattern.test(value)) {
        return new Date(value);
      }
    }
    return value;
  };

  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }
  // Delete keys by pattern using SCAN (safer than KEYS)
  async delByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        '100',
      );
      cursor = nextCursor;
      if (keys.length) {
        const res = await this.client.del(...keys);
        deleted += res;
      }
    } while (cursor !== '0');
    return deleted;
  }

  // Helper wrap: try cache, otherwise call fn and cache result
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const val = await fn();
    await this.set(key, val, ttlSeconds);
    return val;
  }
}
