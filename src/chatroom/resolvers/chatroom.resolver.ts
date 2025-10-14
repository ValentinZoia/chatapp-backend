import { Inject, UseGuards } from '@nestjs/common';
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
import { UserService } from 'src/user/services/user.service';
import { ChatroomEntity } from '../entities/chatroom.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { Request } from 'express';
import { GraphqlAuthGuard } from 'src/auth/guards/auth.guard';
import GraphQLUpload, {
  type FileUpload,
} from 'graphql-upload/GraphQLUpload.mjs';
import { CreateChatroomInput } from '../dtos/inputs/CreateChatroom.input';
import { ChatroomAccessGuard } from 'src/auth/guards/chatroom-access.guard';
import {
  PaginatedMessage,
  MessageEdge,
} from '../dtos/responses/message.responses';
// import { TokenName } from 'src/auth/constants/tokens.constants';

@Resolver()
export class ChatroomResolver {
  constructor(
    @Inject('PUB_SUB') private pubSub: PubSub,
    private readonly chatroomService: ChatroomService,
    private readonly userService: UserService,
  ) {}

  @Subscription(() => MessageEdge, {
    nullable: true,
    resolve: (value) => {
      return value.newMessage;
    },
  })
  newMessage(@Args('chatroomId', { type: () => Int }) chatroomId: number) {
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
  userStoppedTyping(
    @Args('chatroomId') chatroomId: number,
    @Args('userId') userId: number,
  ) {
    return this.pubSub.asyncIterableIterator(`userStoppedTyping.${chatroomId}`);
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation((returns) => UserEntity)
  async userStartedTypingMutation(
    @Args('chatroomId') chatroomId: number,
    @Context() context: { req: Request },
  ) {
    const user = await this.userService.findUserById(context.req.user.sub);
    await this.pubSub
      .publish(`userStartedTyping.${chatroomId}`, {
        user,
        typingUserId: user.id,
      })
      .catch((err) => {
        console.log('StartedTypingErr', err);
      });
    return user;
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => UserEntity, {})
  async userStoppedTypingMutation(
    @Args('chatroomId') chatroomId: number,
    @Context() context: { req: Request },
  ) {
    const user = await this.userService.findUserById(context.req.user.sub);

    await this.pubSub.publish(`userStoppedTyping.${chatroomId}`, {
      user,
      typingUserId: user.id,
    });

    return user;
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => MessageEdge)
  async sendMessage(
    @Args('chatroomId') chatroomId: number,
    @Args('content') content: string,
    @Context() context: { req: Request },
    @Args('image', { type: () => GraphQLUpload, nullable: true })
    image?: FileUpload,
  ): Promise<MessageEdge> {
    let imagePath: string | null = null;
    if (image) imagePath = await this.chatroomService.saveImage(image);

    const newMessage = await this.chatroomService.sendMessage(
      chatroomId,
      content,
      context.req.user.sub,
      imagePath as string,
    );
    // Asegurarse que createdAt siempre tenga valor
    if (!newMessage.node.createdAt) {
      newMessage.node.createdAt = new Date();
    }

    await this.pubSub
      .publish(`newMessage.${chatroomId}`, { newMessage })
      .catch((err) => {
        console.log('err', err);
      });

    return newMessage;
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => ChatroomEntity)
  async createChatroom(
    @Args('createChatroomInput', { type: () => CreateChatroomInput })
    createChatroomInput: CreateChatroomInput,
    @Context() context: { req: Request },
  ) {
    return this.chatroomService.createChatroom(
      createChatroomInput,
      context.req.user.sub,
    );
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => String)
  async addUsersToChatroom(
    @Args('chatroomId') chatroomId: number,
    @Args('userIds', { type: () => [Number] }) userIds: number[],
  ) {
    //VER QUE RETORNA ESTO
    const chatroomName = await this.chatroomService.addUsersToChatroom(
      chatroomId,
      userIds,
    );
    return `Users added to chatroom ${chatroomName} successfully`;
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Query(() => ChatroomEntity, {
    name: 'getChatroomById',
    description: 'Get a chatroom by id',
  })
  async getChatroomById(
    @Args('chatroomId') chatroomId: number,
    @Context() context: { req: Request },
  ) {
    return this.chatroomService.getChatroom(chatroomId);
  }

  // @UseGuards(GraphqlAuthGuard)
  @Query(() => [ChatroomEntity])
  async getChatroomsForUser(
    @Args('userId') userId: number,
    @Context() context: { req: Request },
  ) {
    // if (!context.req.cookies[TokenName.ACCESS]) return [];
    return this.chatroomService.getChatroomsForUser(userId);
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Query(() => PaginatedMessage, { name: 'getMessagesForChatroom' })
  async getMessagesForChatroom(
    @Args('chatroomId') chatroomId: number,
    @Args('take', { type: () => Int, defaultValue: 20 }) take: number,
    @Args('cursor', { type: () => Int, nullable: true }) cursor?: number,
  ): Promise<PaginatedMessage> {
    return this.chatroomService.getMessagesForChatroom(
      chatroomId,
      take,
      cursor,
    );
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Mutation(() => String)
  async deleteChatroom(@Args('chatroomId') chatroomId: number) {
    await this.chatroomService.deleteChatroom(chatroomId);
    return 'Chatroom deleted successfully';
  }
}
