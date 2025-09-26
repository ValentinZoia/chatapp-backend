import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserInput } from '../dtos/update-user.input';
import { UserEntity } from '../entities/user.entity';
import { NotFoundError } from 'rxjs';
import { CreateUserInput } from '../dtos/create-user.input';

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
      throw new HttpException(error, 500);
    }
  }

  async findAllUsers(): Promise<UserEntity[]> {
    try {
      const users = await this.prisma.user.findMany();
      return users;
    } catch (error) {
      throw new HttpException(error, 500);
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
        throw new NotFoundException('User not found');
      }

      return user;
    } catch (error) {
      throw new HttpException(error, 500);
    }
  }

  async findUserBy({
    key,
    value,
  }: {
    key: keyof CreateUserInput;
    value: any;
  }): Promise<UserEntity | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          [key]: value,
        },
      });

      return user;
    } catch (error: any) {
      throw new HttpException(error, 500);
    }
  }
}
