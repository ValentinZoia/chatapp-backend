import { RedisCacheService } from '@/src/common/cache/services/cache.service';
import { PUB_SUB } from '@/src/common/constants';
import { Global, Module } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

/*

- Crear instancia RedisPubSub y exportarla como provider global
- Todos los resolvers/services compartiran la misma conexion a Redis
   asi evitar instancias duplicadas.

- Patrón Pub/Sub : productores PUBlican mensajes en un canal, y
  consumidores se SUBscriben a canales y reciben mensajes.

- Redis Pub/Sub: mecanismo muy rápido, basado en memoria, fire-and-forget.
   -No hay persistencia
   - No hay ack/offsets


*/

const host = process.env.REDIS_HOST || 'localhost';
const port = parseInt(process.env.REDIS_PORT || '6379', 10);
const password = process.env.REDIS_PASSWORD;

const pubSub = new RedisPubSub({
  connection: {
    host,
    port,
    password,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  },
  publisher: new Redis({ host, port, password }),
  subscriber: new Redis({ host, port, password }),
});

@Global()
@Module({
  providers: [
    {
      provide: PUB_SUB,
      useValue: pubSub,
    },
    RedisCacheService,
  ],
  exports: [PUB_SUB, RedisCacheService],
})
export class PubSubModule {}
