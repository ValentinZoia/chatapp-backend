import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { UserEntity } from 'src/user/entities/user.entity';
import { ErrorManager } from 'src/utils/error.manager';

@Injectable()
export class LiveChatroomService {
  private redisClient: Redis;
  constructor() {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  async getLiveUsersForChatroom(chatroomId: number): Promise<UserEntity[]> {
    try {
      const users = await this.redisClient.smembers(
        `liveUsers:chatroom:${chatroomId}`,
      );
      return users.map((user) => JSON.parse(user));
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async addLiveUserToChatroom(
    chatroomId: number,
    user: UserEntity,
  ): Promise<void> {
    try {
      //Buscar si ya existe o no
      const existingUsers = await this.getLiveUsersForChatroom(chatroomId);
      const existingUser = existingUsers.find((u) => u.id === user.id);
      if (!existingUser) {
        await this.redisClient.sadd(
          `liveUsers:chatroom:${chatroomId}`,
          JSON.stringify(user),
        );
      }
      return;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async removeLiveUserFromChatroom(
    chatroomId: number,
    user: UserEntity,
  ): Promise<void> {
    try {
      await this.redisClient
        .srem(`liveUsers:chatroom:${chatroomId}`, JSON.stringify(user))
        .catch((err) => {
          console.log('removeLiveUserFromChatroom error', err);
        })
        .then((res) => {
          console.log('removeLiveUserFromChatroom res', res);
        });
      return;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }
}
