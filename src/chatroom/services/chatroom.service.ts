import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/src/prisma/prisma.service';
import { ErrorManager } from '@/src/utils/error.manager';
import { ChatroomEntity } from '../entities/chatroom.entity';
import { createWriteStream } from 'fs';
import { CreateChatroomInput } from '../dtos/inputs/CreateChatroom.input';
import {
  MessageEdge,
  PaginatedMessage,
} from '../dtos/responses/message.responses';

@Injectable()
export class ChatroomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) { }

  async getChatroom(id: number): Promise<ChatroomEntity> {
    try {
      const chatroom = await this.prisma.chatroom.findUnique({
        where: { id },
        include: {
          users: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });
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

  async createChatroom(
    createChatroomInput: CreateChatroomInput,
    sub: number,
  ): Promise<ChatroomEntity> {

    const { name, description, colorHex, image, access } = createChatroomInput;
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
          description,
          colorHex,
          image,
          access,
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

  async addUsersToChatroom(
    chatroomId: number,
    userIds: number[],
  ): Promise<String> {
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

      const updatedChatroom = await this.prisma.chatroom.update({
        where: {
          id: chatroomId,
        },
        data: {
          users: {
            connect: userIds.map((id) => ({ id })),
          },
        },
      });

      return updatedChatroom.name;
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
            include: {
              user: {
                select: {
                  id: true,
                  fullname: true,
                },
              },
            },
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
  ): Promise<MessageEdge> {
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
      return { node: messageCreated, cursor: messageCreated.id };
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

  async getMessagesForChatroom(
    chatroomId: number,
    take: number,
    cursor?: number,
  ): Promise<PaginatedMessage> {
    try {
      // Limitar el tamaño maximo de la pagina, maximo 50
      const limit = Math.min(take, 50);

      // Configurar el cursor, el cursor es la referencia de cual fue el ultimo mensaje cargado, mediante su id.
      let cursorOption: { cursor?: { id: number }; skip?: number } = {};
      if (cursor) {
        cursorOption = {
          cursor: { id: cursor },
          skip: 1, // para que no me traiga el ultimo mensaje que ya tengo
        };
      } else {
        cursorOption = {
          cursor: undefined,
          skip: undefined,
        };
      }

      const messages = await this.prisma.message.findMany({
        where: {
          chatroomId: chatroomId,
        },
        cursor: cursorOption.cursor,
        skip: cursorOption.skip,
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
          user: {
            select: {
              id: true,
              avatarUrl: true,
              fullname: true,
            },
          },
        },
        take: limit + 1,
        orderBy: {
          createdAt: 'desc',
        },
      });

      //Verificar si hay mensajes
      const hasNextPage = messages.length > limit;

      //Remover mensaje extra si existe
      const nodes = hasNextPage ? messages.slice(0, -1) : messages;

      //Obtener cursor para siguiente pagina ,(el id del ultimo mensaje)
      const endCursor = nodes.length > 0 ? nodes[nodes.length - 1].id : null;

      return {
        edges: nodes
          .map((message) => ({ node: message, cursor: message.id }))
          .reverse(),
        pageInfo: {
          hasNextPage,
          endCursor,
        },
        totalCount: await this.prisma.message.count({
          where: { chatroomId },
        }),
      };
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
