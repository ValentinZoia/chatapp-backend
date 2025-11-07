import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export const initializeStorageRedisConfig = (
  configService: ConfigService,
): RedisOptions => {
  return {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: configService.get('REDIS_PORT', 6379),
    password: configService.get('REDIS_PASSWORD'),
    db: configService.get('REDIS_DB', 0),

    // Opciones adicionales
    keyPrefix: 'throttler:', // Prefijo para keys

    // TLS para producción
    ...(configService.get('REDIS_TLS') === 'true' && {
      tls: {},
    }),
  };
};
