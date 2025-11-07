import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@/src/common/prisma/prisma.service';
import { UpdateUserInput } from '../dtos/update-user.input';
import { UserEntity } from '../entities/user.entity';
import { ErrorManager } from '@/src/common/utils/error.manager';
import type { ILogger } from '@/src/common/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@/src/common/constants/logger.constants';

@Injectable()
export class UserService {
  private readonly context = 'UserService'

  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly prisma: PrismaService
  ) { }

  async updateUser(updateUserInput: UpdateUserInput): Promise<UserEntity> {
    const startTime = Date.now();
    try {

      this.logger.log(
        `Updating user profile with email : ${updateUserInput.email}`,
        this.context
      )

      const updatedUser = await this.prisma.user.update({
        where: {
          id: updateUserInput.id,
        },
        data: updateUserInput,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `User Profile updating successfully`,
        this.context,
        {
          userId: updatedUser.id,
          email: updatedUser.email,
          duration,
        }
      )

      return updatedUser;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to update user profile: ${error.message}`,
        error.stack,
        this.context,
        {
          email: updateUserInput.email,
          duration,
        },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async findAllUsers(): Promise<UserEntity[]> {
    const startTime = Date.now();
    try {
      this.logger.log('Fetching users', this.context,);
      const users = await this.prisma.user.findMany();


      const duration = Date.now() - startTime;
      this.logger.log(
        'Users retrieved',
        this.context,
        {
          count: users.length,
          duration,
          hasFilters: false,
        },
      );
      return users;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to fetch users: ${error.message}`,
        error.stack,
        this.context,
        {

          duration,
          hasFilters: false
        },
      );

      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async findUserById(id: number): Promise<UserEntity> {
    const startTime = Date.now();
    try {

      this.logger.debug(`Searching for user with id: ${id}`, this.context);

      const user = await this.prisma.user.findUnique({
        where: {
          id,
        },
      });

      if (!user) {

        const duration = Date.now() - startTime;
        this.logger.warn('User not found', this.context, { userId: id, duration });

        throw new ErrorManager({
          type: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const duration = Date.now() - startTime;
      this.logger.debug('User found', this.context, { userId: id, duration });
      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to search user by id : ${error.message}`,
        error.stack,
        this.context,
        {
          userId: id,
          duration,
        },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async searchUsers(fullname: string, userId: number): Promise<UserEntity[]> {
    const startTime = Date.now();
    try {
      this.logger.log(
        `Searching users by fullname pattern`,
        this.context,
        {
          searchPattern: fullname,
          excludedUserId: userId
        }
      );

      const users = await this.prisma.user.findMany({
        where: {
          id: {
            not: userId,
          },
          fullname: {
            contains: fullname,
            mode: 'insensitive',
          },
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        'Users search completed',
        this.context,
        {
          count: users.length,
          searchPattern: fullname,
          excludedUserId: userId,
          duration
        }
      );

      return users;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to search users: ${error.message}`,
        error.stack,
        this.context,
        {
          searchPattern: fullname,
          excludedUserId: userId,
          duration
        }
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async getUsersOfChatroom(chatroomId: number): Promise<UserEntity[]> {
    const startTime = Date.now();
    try {
      this.logger.log(
        `Fetching users from chatroom`,
        this.context,
        {
          chatroomId
        }
      );

      const users = await this.prisma.user.findMany({
        where: {
          chatrooms: {
            some: {
              id: chatroomId,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        'Chatroom users retrieved',
        this.context,
        {
          chatroomId,
          count: users.length,
          duration
        }
      );

      return users;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to fetch chatroom users: ${error.message}`,
        error.stack,
        this.context,
        {
          chatroomId,
          duration
        }
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  // async findUserBy({
  //   key,
  //   value,
  // }: {
  //   key: keyof CreateUserInput;
  //   value: any;
  // }): Promise<UserEntity | null> {
  //   try {
  //     const user = await this.prisma.user.findFirst({
  //       where: {
  //         [key]: value,
  //       },
  //     });

  //     return user;
  //   } catch (error: any) {
  //     throw ErrorManager.createSignatureError(error.message);
  //   }
  // }
}
