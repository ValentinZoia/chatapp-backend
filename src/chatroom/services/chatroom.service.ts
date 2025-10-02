import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { ErrorManager } from 'src/utils/error.manager';
import { ChatroomEntity, MessageEntity } from '../entities/chatroom.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { createWriteStream } from 'fs';

@Injectable()
export class ChatroomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getChatroom(id: number): Promise<ChatroomEntity> {
    try {
      const chatroom = await this.prisma.chatroom.findUnique({ where: { id } });
      if (!chatroom) {
        throw new ErrorManager({
          type: 'NOT_FOUND',
          message: 'Chatroom not found',
        });
      }

      return chatroom;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async createChatroom(name: string, sub: number): Promise<ChatroomEntity> {
    try {
      const existingChatroom = await this.prisma.chatroom.findFirst({
        where: {
          name,
        },
      });

      if (existingChatroom) {
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Chatroom with this name already exists',
        });
      }

      const createdChatroom = await this.prisma.chatroom.create({
        data: {
          name,
          adminId: sub,
          users: {
            connect: {
              id: sub,
            },
          },
        },
      });

      return createdChatroom;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async addUsersToChatroom(chatroomId: number, userIds: number[]) {
    try {
      const existingChatroom = await this.prisma.chatroom.findUnique({
        where: {
          id: chatroomId,
        },
      });

      if (!existingChatroom) {
        throw new ErrorManager({
          type: 'NOT_FOUND',
          message: 'Chatroom not found',
        });
      }

      await this.prisma.chatroom.update({
        where: {
          id: chatroomId,
        },
        data: {
          users: {
            connect: userIds.map((id) => ({ id })),
          },
        },
      });
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async getChatroomsForUser(userId: number) {
    try {
      const chatrooms = await this.prisma.chatroom.findMany({
        where: {
          users: {
            some: {
              id: userId,
            },
          },
        },
        include: {
          users: {
            orderBy: {
              createdAt: 'desc',
            },
          },
          messages: {
            //para mostrar el ult mensaje
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      return chatrooms;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async sendMessage(
    chatroomId: number,
    message: string,
    userId: number,
    imagePath: string,
  ) {
    try {
      const messageCreated = await this.prisma.message.create({
        data: {
          chatroomId,
          userId,
          content: message,
          imageUrl: imagePath,
        },
        include: {
          chatroom: {
            include: {
              users: true, // Eager loading users
            },
          }, // Eager loading Chatroom
          user: true, // Eager loading User
        },
      });
      return messageCreated;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async saveImage(image: {
    createReadStream: () => any;
    filename: string;
    mimetype: string;
  }) {
    try {
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!validImageTypes.includes(image.mimetype)) {
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Invalid image type',
        });
      }

      const imageName = `${Date.now()}-${image.filename}`;
      const imagePath = `${this.configService.get('IMAGE_PATH')}/${imageName}`;
      const stream = image.createReadStream();
      const outputPath = `public${imagePath}`;
      const writeStream = createWriteStream(outputPath);
      stream.pipe(writeStream);

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      return imagePath;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async getMessagesForChatroom(chatroomId: number) {
    try {
      return await this.prisma.message.findMany({
        where: {
          chatroomId: chatroomId,
        },
        include: {
          chatroom: {
            include: {
              users: {
                orderBy: {
                  createdAt: 'asc',
                },
              }, // Eager loading users
            },
          }, // Eager loading Chatroom
          user: true, // Eager loading User
        },
      });
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async deleteChatroom(chatroomId: number) {
    try {
      return this.prisma.chatroom.delete({
        where: {
          id: chatroomId,
        },
      });
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }
}
