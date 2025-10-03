import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserInput } from '../dtos/update-user.input';
import { UserEntity } from '../entities/user.entity';
import { ErrorManager } from 'src/utils/error.manager';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async updateUser(updateUserInput: UpdateUserInput): Promise<UserEntity> {
    try {
      const updatedUser = await this.prisma.user.update({
        where: {
          id: updateUserInput.id,
        },
        data: updateUserInput,
      });

      return updatedUser;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async findAllUsers(): Promise<UserEntity[]> {
    try {
      const users = await this.prisma.user.findMany();
      return users;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async findUserById(id: number): Promise<UserEntity> {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id,
        },
      });

      if (!user) {
        throw new ErrorManager({
          type: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return user;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async searchUsers(fullname: string, userId: number): Promise<UserEntity[]> {
    try {
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
      return users;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async getUsersOfChatroom(chatroomId: number): Promise<UserEntity[]> {
    try {
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
      console.log('USERS', users);
      return users;
    } catch (error) {
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
