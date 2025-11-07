import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { UserEntity } from '@/src/modules/user/entities/user.entity';
import { ErrorManager } from '@/src/common/utils/error.manager';
import type { ILogger } from '@/src/common/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@/src/common/constants/logger.constants';

/*
Redis se usa como una base de datos en memoria para almacenar este estado.
Por eso lo usamos aca, estamos guardando los usuarios en linea.
PubSub se usa para la comunicación en tiempo real (mensajes, eventos) pero no para almacenar estado. Es un patron de mensajeeria.
cuando se crea/publica un nuevo mensaje, redis pubsub lo envia a los subsciptores. pero nunca guarda ese mensaje.
solo lo envia.

*/

@Injectable()
export class LiveChatroomService {
  private readonly context = 'LiveChatroomService';
  private redisClient: Redis;

  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    // Inicializamos el cliente Redis para gestionar el estado en tiempo real de usuarios
    // en las salas de chat. Redis es ideal para esto por su velocidad y estructuras de datos
    // especializadas como Sets (SADD, SREM, SMEMBERS)
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    });
  }

  /**
   * Obtiene la lista de usuarios activos en una sala de chat específica.
   * Utiliza SMEMBERS de Redis para obtener todos los miembros del Set.
   * Los usuarios se almacenan como strings JSON en Redis y se deserializan al retornarlos.
   */
  async getLiveUsersForChatroom(chatroomId: number): Promise<UserEntity[]> {
    const startTime = Date.now();
    try {
      this.logger.debug('Fetching live users from chatroom', this.context, {
        chatroomId,
      });

      // SMEMBERS retorna todos los miembros de un Set en Redis
      const users = await this.redisClient.smembers(
        `liveUsers:chatroom:${chatroomId}`,
      );

      const parsedUsers = users.map((user) => JSON.parse(user));

      const duration = Date.now() - startTime;
      this.logger.debug('Retrieved live users successfully', this.context, {
        chatroomId,
        userCount: parsedUsers.length,
        duration,
      });

      return parsedUsers;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to get live users: ${error.message}`,
        error.stack,
        this.context,
        {
          chatroomId,
          duration,
        },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  /**
   * Agrega un usuario a la lista de usuarios activos en una sala de chat.
   * Utiliza SADD de Redis que añade elementos a un Set.
   * Verifica primero si el usuario ya existe para evitar duplicados.
   */
  async addLiveUserToChatroom(
    chatroomId: number,
    user: UserEntity,
  ): Promise<void> {
    const startTime = Date.now();
    try {
      this.logger.debug('Adding user to live chatroom', this.context, {
        chatroomId,
        userId: user.id,
      });

      // SADD añade un elemento al Set solo si no existe.no inserta duplicados.
      const wasAdded = await this.redisClient.sadd(
        `liveUsers:chatroom:${chatroomId}`,
        JSON.stringify(user),
      );

      //si lo agregó o ya existía (SADD devuelve 1 o 0).
      const duration = Date.now() - startTime;
      if (wasAdded === 0) {
        this.logger.debug('User already in chatroom', this.context, {
          chatroomId,
          userId: user.id,
          duration,
        });
      } else {
        this.logger.log('User entered chatroom', this.context, {
          chatroomId,
          userId: user.id,
          duration,
        });
      }

      //Buscar si ya existe o no
      // const existingUsers = await this.getLiveUsersForChatroom(chatroomId);
      // const existingUser = existingUsers.find((u) => u.id === user.id);

      // if (!existingUser) {
      //   // SADD añade un elemento al Set solo si no existe
      //   await this.redisClient.sadd(
      //     `liveUsers:chatroom:${chatroomId}`,
      //     JSON.stringify(user),
      //   );

      //   const duration = Date.now() - startTime;
      //   this.logger.log('User added to live chatroom', this.context, {
      //     chatroomId,
      //     userId: user.id,
      //     duration,
      //   });
      // } else {
      //   const duration = Date.now() - startTime;
      //   this.logger.debug('User already in live chatroom', this.context, {
      //     chatroomId,
      //     userId: user.id,
      //     duration,
      //   });
      // }

      return;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to add user to live chatroom: ${error.message}`,
        error.stack,
        this.context,
        {
          chatroomId,
          userId: user.id,
          duration,
        },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  /**
   * Elimina un usuario de la lista de usuarios activos en una sala de chat.
   * Utiliza SREM de Redis que elimina elementos de un Set.
   * No verifica existencia previa ya que SREM es idempotente.
   */
  async removeLiveUserFromChatroom(
    chatroomId: number,
    user: UserEntity,
  ): Promise<void> {
    const startTime = Date.now();
    try {
      this.logger.debug('Removing user from live chatroom', this.context, {
        chatroomId,
        userId: user.id,
      });

      // SREM elimina el elemento del Set si existe
      await this.redisClient
        .srem(`liveUsers:chatroom:${chatroomId}`, JSON.stringify(user))
        .catch((err) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            'Redis SREM operation failed',
            err.stack,
            this.context,
            {
              chatroomId,
              userId: user.id,
              duration,
            },
          );
        });

      const duration = Date.now() - startTime;
      this.logger.log('User removed from live chatroom', this.context, {
        chatroomId,
        userId: user.id,
        duration,
      });

      return;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to remove user from live chatroom: ${error.message}`,
        error.stack,
        this.context,
        {
          chatroomId,
          userId: user.id,
          duration,
        },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }
}
