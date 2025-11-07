import { Inject, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  Args,
  Context,
  Int,
  Mutation,
  Query,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { ChatroomService } from '../services/chatroom.service';
import { UserService } from '@/src/modules/user/services/user.service';
import { ChatroomEntity } from '../entities/chatroom.entity';
import { UserEntity } from '@/src/modules/user/entities/user.entity';
import { Request } from 'express';
import { GraphqlAuthGuard } from '@/src/modules/auth/guards/auth.guard';
import GraphQLUpload, {
  type FileUpload,
} from 'graphql-upload/GraphQLUpload.mjs';
import { CreateChatroomInput } from '../dtos/inputs/CreateChatroom.input';
import { ChatroomAccessGuard } from '@/src/modules/auth/guards/chatroom-access.guard';
import {
  PaginatedMessage,
  MessageEdge,
} from '../dtos/responses/message.responses';
import { storeImageAndGetUrl } from '@/src/common/utils/storeImage';
import { SearchChatroomsResult } from '../dtos/responses/getAllChatrooms.response';
import type { GraphQLContext } from '@/src/common/interfaces/graphql-context.interface';
import { LOGGER_SERVICE, PUB_SUB } from '@/src/common/constants';
import type { ILogger } from '@/src/common/interfaces/logger.interface';
import { SubscriptionLoggingInterceptor } from '@/src/common/interceptors/subscription-loggin.interceptors';
import { seconds, SkipThrottle, Throttle } from '@nestjs/throttler';
// import { TokenName } from 'src/auth/constants/tokens.constants';
const NEW_MESSAGE = 'NEW_MESSAGE';
@Resolver()
@SkipThrottle()
export class ChatroomResolver {
  private readonly context = 'ChatroomResolver';

  constructor(
    @Inject(PUB_SUB) private pubSub: PubSub,
    private readonly chatroomService: ChatroomService,
    private readonly userService: UserService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  @Subscription(() => MessageEdge, {
    nullable: true,
    resolve: (value) => {
      return value.newMessage;
    },
  })
  @SkipThrottle()
  @UseInterceptors(SubscriptionLoggingInterceptor)
  newMessage(@Args('chatroomId', { type: () => Int }) chatroomId: number) {
    this.logger.log(
      'New Subscription client connected: postCreated',
      this.context,
    );
    return this.pubSub.asyncIterableIterator(`newMessage.${chatroomId}`);
  }

  @Subscription(() => UserEntity, {
    nullable: true,
    resolve: (value) => value.user,
    filter: (payload, variables) => {
      //si la condicion es igual, solo me mostrará cuando el usuario logeado (osea yo) este escribiendo
      //por eso es que debe ser !== . para que me muestre cuando otro este escribiendo
      return variables.userId !== payload.typingUserId;
    },
  })
  @SkipThrottle()
  userStartedTyping(
    @Args('chatroomId') chatroomId: number,
    @Args('userId') userId: number,
  ) {
    const res = this.pubSub.asyncIterableIterator(
      `userStartedTyping.${chatroomId}`,
    );

    return res;
  }

  @Subscription(() => UserEntity, {
    nullable: true,
    resolve: (value) => value.user,
    filter: (payload, variables) => {
      return variables.userId !== payload.typingUserId;
    },
  })
  @SkipThrottle()
  userStoppedTyping(
    @Args('chatroomId') chatroomId: number,
    @Args('userId') userId: number,
  ) {
    return this.pubSub.asyncIterableIterator(`userStoppedTyping.${chatroomId}`);
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation((returns) => UserEntity)
  @SkipThrottle()
  async userStartedTypingMutation(
    @Args('chatroomId') chatroomId: number,
    @Context() { req, correlationId }: GraphQLContext,
  ) {
    this.logger.debug('Mutation: userStartedTyping', this.context, {
      correlationId,
      chatroomId,
      userId: req.user.sub,
    });

    const user = await this.userService.findUserById(req.user.sub);

    await this.pubSub
      .publish(`userStartedTyping.${chatroomId}`, {
        user,
        typingUserId: user.id,
      })
      .then(() => {
        this.logger.debug('Typing status published to Redis', this.context, {
          correlationId,
          event: 'USER_STARTED_TYPING',
          chatroomId,
          userId: user.id,
        });
      })
      .catch((err) => {
        this.logger.error(
          'Failed to publish typing status to Redis',
          err.stack,
          this.context,
          {
            correlationId,
            event: 'USER_STARTED_TYPING',
            chatroomId,
            userId: user.id,
            error: err.message,
          },
        );
      });
    return user;
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => UserEntity)
  @SkipThrottle()
  async userStoppedTypingMutation(
    @Args('chatroomId') chatroomId: number,
    @Context() { req, correlationId }: GraphQLContext,
  ) {
    this.logger.debug('Mutation: userStoppedTyping', this.context, {
      correlationId,
      chatroomId,
      userId: req.user.sub,
    });

    const user = await this.userService.findUserById(req.user.sub);

    await this.pubSub
      .publish(`userStoppedTyping.${chatroomId}`, {
        user,
        typingUserId: user.id,
      })
      .then(() => {
        this.logger.debug('Typing status published to Redis', this.context, {
          correlationId,
          event: 'USER_STOPPED_TYPING',
          chatroomId,
          userId: user.id,
        });
      })
      .catch((err) => {
        this.logger.error(
          'Failed to publish typing status to Redis',
          err.stack,
          this.context,
          {
            correlationId,
            event: 'USER_STOPPED_TYPING',
            chatroomId,
            userId: user.id,
            error: err.message,
          },
        );
      });

    return user;
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => MessageEdge)
  @Throttle({ short: { limit: 2, ttl: seconds(3) } }) // 2 request por 3 segundos
  async sendMessage(
    @Args('chatroomId') chatroomId: number,
    @Args('content') content: string,
    @Context() { req, correlationId }: GraphQLContext,
    @Args('image', { type: () => GraphQLUpload, nullable: true })
    image?: FileUpload,
  ): Promise<MessageEdge> {
    this.logger.log('Mutation: sendMessage (with subscription)', this.context, {
      correlationId,
      contentMessage: content,
    });

    let imagePath: string | null = null;
    if (image) imagePath = await storeImageAndGetUrl(image);

    const newMessage = await this.chatroomService.sendMessage(
      chatroomId,
      content,
      req.user.sub,
      imagePath as string,
    );
    // Asegurarse que createdAt siempre tenga valor
    if (!newMessage.node.createdAt) {
      newMessage.node.createdAt = new Date();
    }

    await this.pubSub
      .publish(`newMessage.${chatroomId}`, { newMessage })
      .then(() => {
        this.logger.log('Event published to Redis', this.context, {
          event: NEW_MESSAGE,
          messageId: newMessage.cursor,
        });
      })
      .catch((err) => {
        this.logger.error(
          'Filed to publish event to Redis',
          err.stack,
          this.context,
          {
            event: NEW_MESSAGE,
            messageId: newMessage.cursor,
            error: err.message,
          },
        );
      });

    return newMessage;
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => ChatroomEntity)
  @Throttle({ short: { limit: 2, ttl: seconds(3) } })
  async createChatroom(
    @Args('createChatroomInput', { type: () => CreateChatroomInput })
    createChatroomInput: CreateChatroomInput,
    @Context() { req, correlationId }: GraphQLContext,
  ) {
    this.logger.log('Mutation: createChatroom', this.context, {
      correlationId,
      userId: req.user.sub,
      chatroomName: createChatroomInput.name,
      access: createChatroomInput.access,
    });
    return this.chatroomService.createChatroom(
      createChatroomInput,
      req.user.sub,
    );
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => String)
  @Throttle({ short: { limit: 3, ttl: seconds(5) } })
  async addUsersToChatroom(
    @Args('chatroomId') chatroomId: number,
    @Args('userIds', { type: () => [Number] }) userIds: number[],
    @Context() { correlationId }: GraphQLContext,
  ) {
    this.logger.log('Mutation: addUsersToChatroom', this.context, {
      correlationId,
      chatroomId,
      userCount: userIds.length,
      userIds,
    });

    const chatroomName = await this.chatroomService.addUsersToChatroom(
      chatroomId,
      userIds,
    );

    this.logger.log('Users added to chatroom successfully', this.context, {
      correlationId,
      chatroomId,
      chatroomName,
      addedUsers: userIds.length,
    });

    return `Users added to chatroom ${chatroomName} successfully`;
  }

  @UseGuards(GraphqlAuthGuard)
  @Query(() => SearchChatroomsResult, {
    name: 'getChatroomsForSearch',
    description: 'Get chatrooms for search functionality',
  })
  @Throttle({ short: { limit: 5, ttl: seconds(5) } }) // 5 requests/5s
  async getChatroomsForSearch(
    @Args('searchTerm') searchTerm: string,
    @Args('limit', { type: () => Int, nullable: true }) limit: number,
    @Context() { req, correlationId }: GraphQLContext,
  ) {
    this.logger.debug('Query: getChatroomsForSearch', this.context, {
      correlationId,
      searchTerm,
      limit,
      userId: req.user.sub,
    });
    return await this.chatroomService.getChatroomsForSearch(
      searchTerm,
      limit,
      req.user.sub,
    );
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Query(() => ChatroomEntity, {
    name: 'getChatroomById',
    description: 'Get a chatroom by id',
  })
  @Throttle({ short: { limit: 10, ttl: seconds(5) } }) // 10 requests/5s
  async getChatroomById(
    @Args('chatroomId') chatroomId: number,
    @Context() { req, correlationId }: GraphQLContext,
  ) {
    this.logger.debug('Query: getChatroomById', this.context, {
      correlationId,
      chatroomId,
      userId: req.user.sub,
    });
    return this.chatroomService.getChatroom(chatroomId);
  }

  // @UseGuards(GraphqlAuthGuard)
  @Query(() => [ChatroomEntity])
  @Throttle({ short: { limit: 10, ttl: seconds(5) } }) // 10 requests/5s
  async getChatroomsForUser(
    @Args('userId') userId: number,
    @Context() { req, correlationId }: GraphQLContext,
  ) {
    this.logger.debug('Query: getChatroomsForUser', this.context, {
      correlationId,
      userId,
    });
    return this.chatroomService.getChatroomsForUser(userId);
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Query(() => PaginatedMessage, { name: 'getMessagesForChatroom' })
  @Throttle({ short: { limit: 10, ttl: seconds(5) } }) // 10 requests/5s
  async getMessagesForChatroom(
    @Context() { correlationId }: GraphQLContext,
    @Args('chatroomId') chatroomId: number,
    @Args('take', { type: () => Int, defaultValue: 20 }) take: number,
    @Args('cursor', { type: () => Int, nullable: true }) cursor?: number,
  ): Promise<PaginatedMessage> {
    this.logger.debug('Query: getMessagesForChatroom', this.context, {
      correlationId,
      chatroomId,
      take,
      cursor,
    });
    return this.chatroomService.getMessagesForChatroom(
      chatroomId,
      take,
      cursor,
    );
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Mutation(() => String)
  @Throttle({ short: { limit: 2, ttl: seconds(3) } }) // 2 request por 3 segundos
  async deleteChatroom(
    @Args('chatroomId') chatroomId: number,
    @Context() { req, correlationId }: GraphQLContext,
  ) {
    this.logger.log('Mutation: deleteChatroom', this.context, {
      correlationId,
      chatroomId,
      userId: req.user.sub,
    });

    await this.chatroomService.deleteChatroom(chatroomId);

    this.logger.log('Chatroom deleted successfully', this.context, {
      correlationId,
      chatroomId,
      userId: req.user.sub,
    });

    return 'Chatroom deleted successfully';
  }
}
