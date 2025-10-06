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
import { ChatroomEntity, MessageEntity } from '../entities/chatroom.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { Request } from 'express';
import { GraphqlAuthGuard } from 'src/auth/guards/auth.guard';
import GraphQLUpload, {
  type FileUpload,
} from 'graphql-upload/GraphQLUpload.mjs';
import { CreateChatroomInput } from '../dtos/inputs/CreateChatroom.input';

@Resolver()
export class ChatroomResolver {
  constructor(
    @Inject('PUB_SUB') private pubSub: PubSub,
    private readonly chatroomService: ChatroomService,
    private readonly userService: UserService,
  ) {}

  @Subscription(() => MessageEntity, {
    nullable: true,
    resolve: (value) => value.newMessage,
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
    await this.pubSub.publish(`userStartedTyping.${chatroomId}`, {
      user,
      typingUserId: user.id,
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
  @Mutation(() => MessageEntity)
  async sendMessage(
    @Args('chatroomId') chatroomId: number,
    @Args('content') content: string,
    @Context() context: { req: Request },
    @Args('image', { type: () => GraphQLUpload, nullable: true })
    image?: FileUpload,
  ) {
    let imagePath: string | null = null;
    if (image) imagePath = await this.chatroomService.saveImage(image);
    const newMessage = await this.chatroomService.sendMessage(
      chatroomId,
      content,
      context.req.user.sub,
      imagePath as string,
    );
    await this.pubSub
      .publish(`newMessage.${chatroomId}`, { newMessage })
      .then((res) => {
        console.log('published', res);
      })
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

  @Mutation(() => ChatroomEntity)
  async addUsersToChatroom(
    @Args('chatroomId') chatroomId: number,
    @Args('userIds', { type: () => [Number] }) userIds: number[],
  ) {
    //VER QUE RETORNA ESTO
    return this.chatroomService.addUsersToChatroom(chatroomId, userIds);
  }

  @Query(() => ChatroomEntity, {
    name: 'getChatroomById',
    description: 'Get a chatroom by id',
  })
  async getChatroomById(@Args('chatroomId') chatroomId: number) {
    return this.chatroomService.getChatroom(chatroomId);
  }

  @Query(() => [ChatroomEntity])
  async getChatroomsForUser(@Args('userId') userId: number) {
    return this.chatroomService.getChatroomsForUser(userId);
  }

  @Query(() => [MessageEntity])
  async getMessagesForChatroom(@Args('chatroomId') chatroomId: number) {
    return this.chatroomService.getMessagesForChatroom(chatroomId);
  }
  @Mutation(() => String)
  async deleteChatroom(@Args('chatroomId') chatroomId: number) {
    await this.chatroomService.deleteChatroom(chatroomId);
    return 'Chatroom deleted successfully';
  }
}
