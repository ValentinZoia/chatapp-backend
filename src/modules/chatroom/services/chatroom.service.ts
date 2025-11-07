import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/src/common/prisma/prisma.service';
import { ErrorManager } from '@/src/common/utils/error.manager';
import { ChatroomEntity } from '../entities/chatroom.entity';
import { createWriteStream } from 'fs';
import { CreateChatroomInput } from '../dtos/inputs/CreateChatroom.input';
import {
  MessageEdge,
  PaginatedMessage,
} from '../dtos/responses/message.responses';
import { ChatroomAccess } from '@prisma/client';
import { SearchChatroomsResult } from '../dtos/responses/getAllChatrooms.response';
import type { ILogger } from '@/src/common/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@/src/common/constants/logger.constants';

@Injectable()
export class ChatroomService {
  private readonly context = 'ChatroomService';

  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) { }

  async getChatroom(id: number): Promise<ChatroomEntity> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching chatroom by id`,
        this.context,
        { chatroomId: id }
      );

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
        const duration = Date.now() - startTime;
        this.logger.warn(
          'Chatroom not found',
          this.context,
          { chatroomId: id, duration }
        );
        throw new ErrorManager({
          type: 'NOT_FOUND',
          message: 'Chatroom not found',
        });
      }

      const duration = Date.now() - startTime;
      this.logger.debug(
        'Chatroom retrieved successfully',
        this.context,
        {
          chatroomId: id,
          userCount: chatroom.users.length,
          duration
        }
      );

      return chatroom;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to fetch chatroom: ${error.message}`,
        error.stack,
        this.context,
        {
          chatroomId: id,
          duration
        }
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async getChatroomsForSearch(
    searchTerm: string,
    limit: number,
    userId: number,
  ): Promise<SearchChatroomsResult> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        'Starting chatroom search',
        this.context,
        {
          searchTerm,
          limit,
          userId
        }
      );

      // Sanitizar el término de búsqueda
      const sanitizedTerm = searchTerm.trim();

      if (!sanitizedTerm) {
        const duration = Date.now() - startTime;
        this.logger.debug(
          'Empty search term, returning empty results',
          this.context,
          { duration }
        );
        return {
          chatrooms: [],
          totalCount: 0,
        };
      }

      // Construir el where clause para buscar en salas públicas
      // O salas privadas donde el usuario es miembro
      const whereClause = {
        OR: [
          {
            // Salas públicas que coincidan con la búsqueda
            access: ChatroomAccess.PUBLIC,
            name: {
              contains: sanitizedTerm,
              mode: 'insensitive' as const,
            },
          },
          {
            // Salas donde el usuario es miembro que coincidan con la búsqueda
            users: {
              some: {
                id: userId,
              },
            },
            name: {
              contains: sanitizedTerm,
              mode: 'insensitive' as const,
            },
          },
        ],
      };

      // Obtener el conteo total
      const totalCount = await this.prisma.chatroom.count({
        where: whereClause,
      });

      // Obtener los chatrooms con límite
      const chatrooms = await this.prisma.chatroom.findMany({
        where: whereClause,
        take: limit,
        orderBy: [
          // Priorizar salas donde el usuario es miembro
          {
            users: {
              _count: 'desc',
            },
          },
          // Luego por fecha de creación
          {
            createdAt: 'desc',
          },
        ],
        include: {
          users: {
            take: 3, // Solo los primeros 3 usuarios para preview
            select: {
              id: true,
              fullname: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              users: true,
              messages: true,
            },
          },
        },
      });

      const duration = Date.now() - startTime;
      this.logger.debug(
        'Chatroom search completed',
        this.context,
        {
          searchTerm: sanitizedTerm,
          foundCount: chatrooms.length,
          totalCount,
          duration,
          userId
        }
      );

      return {
        chatrooms,
        totalCount,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to search chatrooms: ${error.message}`,
        error.stack,
        this.context,
        {
          searchTerm,
          userId,
          duration
        }
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async createChatroom(
    createChatroomInput: CreateChatroomInput,
    sub: number,
  ): Promise<ChatroomEntity> {
    const startTime = Date.now();
    const { name, description, colorHex, image, access } = createChatroomInput;

    try {
      this.logger.log(
        'Creating new chatroom',
        this.context,
        {
          name,
          access,
          adminId: sub
        }
      );

      const existingChatroom = await this.prisma.chatroom.findFirst({
        where: {
          name,
        },
      });

      if (existingChatroom) {
        const duration = Date.now() - startTime;
        this.logger.warn(
          'Attempted to create chatroom with existing name',
          this.context,
          {
            name,
            duration,
            adminId: sub
          }
        );
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

      const duration = Date.now() - startTime;
      this.logger.log(
        'Chatroom created successfully',
        this.context,
        {
          chatroomId: createdChatroom.id,
          name,
          access,
          adminId: sub,
          duration
        }
      );

      return createdChatroom;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to create chatroom: ${error.message}`,
        error.stack,
        this.context,
        {
          name,
          adminId: sub,
          duration
        }
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async addUsersToChatroom(
    chatroomId: number,
    userIds: number[],
  ): Promise<String> {
    const startTime = Date.now();
    try {
      this.logger.log(
        'Adding users to chatroom',
        this.context,
        {
          chatroomId,
          userCount: userIds.length,
          userIds
        }
      );

      const existingChatroom = await this.prisma.chatroom.findUnique({
        where: {
          id: chatroomId,
        },
      });

      if (!existingChatroom) {
        const duration = Date.now() - startTime;
        this.logger.warn(
          'Attempted to add users to non-existent chatroom',
          this.context,
          {
            chatroomId,
            userIds,
            duration
          }
        );
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

      const duration = Date.now() - startTime;
      this.logger.log(
        'Users added to chatroom successfully',
        this.context,
        {
          chatroomId,
          chatroomName: updatedChatroom.name,
          addedUsers: userIds.length,
          duration
        }
      );

      return updatedChatroom.name;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to add users to chatroom: ${error.message}`,
        error.stack,
        this.context,
        {
          chatroomId,
          userIds,
          duration
        }
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async getChatroomsForUser(userId: number) {
    const startTime = Date.now();
    try {
      this.logger.debug(
        'Fetching user chatrooms',
        this.context,
        { userId }
      );

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

      const duration = Date.now() - startTime;
      this.logger.debug(
        'User chatrooms retrieved successfully',
        this.context,
        {
          userId,
          chatroomCount: chatrooms.length,
          hasMessages: chatrooms.some(c => c.messages.length > 0),
          duration
        }
      );

      return chatrooms;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to fetch user chatrooms: ${error.message}`,
        error.stack,
        this.context,
        {
          userId,
          duration
        }
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async sendMessage(
    chatroomId: number,
    message: string,
    userId: number,
    imagePath: string,
  ): Promise<MessageEdge> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        'Creating new message',
        this.context,
        {
          chatroomId,
          userId,
          hasImage: !!imagePath,
          messageLength: message?.length
        }
      );

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

      const duration = Date.now() - startTime;
      this.logger.debug(
        'Message created successfully',
        this.context,
        {
          messageId: messageCreated.id,
          chatroomId,
          userId,
          hasImage: !!imagePath,
          duration
        }
      );

      return { node: messageCreated, cursor: messageCreated.id };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to create message: ${error.message}`,
        error.stack,
        this.context,
        {
          chatroomId,
          userId,
          hasImage: !!imagePath,
          duration
        }
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async saveImage(image: {
    createReadStream: () => any;
    filename: string;
    mimetype: string;
  }) {
    const startTime = Date.now();
    try {
      this.logger.debug(
        'Processing image upload',
        this.context,
        {
          filename: image.filename,
          mimetype: image.mimetype
        }
      );

      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!validImageTypes.includes(image.mimetype)) {
        const duration = Date.now() - startTime;
        this.logger.warn(
          'Invalid image type attempted',
          this.context,
          {
            filename: image.filename,
            mimetype: image.mimetype,
            duration
          }
        );
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

      const duration = Date.now() - startTime;
      this.logger.debug(
        'Image saved successfully',
        this.context,
        {
          filename: image.filename,
          path: imagePath,
          duration
        }
      );

      return imagePath;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to save image: ${error.message}`,
        error.stack,
        this.context,
        {
          filename: image.filename,
          mimetype: image.mimetype,
          duration
        }
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async getMessagesForChatroom(
    chatroomId: number,
    take: number,
    cursor?: number,
  ): Promise<PaginatedMessage> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        'Fetching paginated messages',
        this.context,
        {
          chatroomId,
          requestedCount: take,
          fromCursor: cursor
        }
      );

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

      const totalCount = await this.prisma.message.count({
        where: { chatroomId },
      });

      const duration = Date.now() - startTime;
      this.logger.debug(
        'Messages retrieved successfully',
        this.context,
        {
          chatroomId,
          retrievedCount: nodes.length,
          hasNextPage,
          totalCount,
          duration
        }
      );

      return {
        edges: nodes
          .map((message) => ({ node: message, cursor: message.id }))
          .reverse(),
        pageInfo: {
          hasNextPage,
          endCursor,
        },
        totalCount,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to fetch messages: ${error.message}`,
        error.stack,
        this.context,
        {
          chatroomId,
          requestedCount: take,
          fromCursor: cursor,
          duration
        }
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async deleteChatroom(chatroomId: number) {
    const startTime = Date.now();
    try {
      this.logger.log(
        'Deleting chatroom',
        this.context,
        { chatroomId }
      );

      const chatroom = await this.prisma.chatroom.delete({
        where: {
          id: chatroomId,
        },
        include: {
          _count: {
            select: {
              users: true,
              messages: true
            }
          }
        }
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        'Chatroom deleted successfully',
        this.context,
        {
          chatroomId,
          chatroomName: chatroom.name,
          deletedUsersCount: chatroom._count.users,
          deletedMessagesCount: chatroom._count.messages,
          duration
        }
      );

      return chatroom;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to delete chatroom: ${error.message}`,
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
}
