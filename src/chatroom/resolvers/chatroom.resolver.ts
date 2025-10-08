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
import { ChatroomAccessGuard } from 'src/auth/guards/chatroom-access.guard';
// import { TokenName } from 'src/auth/constants/tokens.constants';

@Resolver()
export class ChatroomResolver {
  constructor(
    @Inject('PUB_SUB') private pubSub: PubSub,
    private readonly chatroomService: ChatroomService,
    private readonly userService: UserService,
  ) {}

  @Subscription(() => MessageEntity, {
    nullable: true,
    resolve: (value) => {
      //EN UN FUTURO SOLUCIONAR ESTO.
      console.log(
        'EL CREATE DEL VALUE ES:',
        value.newMessage.createdAt +
          'Y SU TIPO ES' +
          typeof value.newMessage.createdAt,
      ); //EL CREATE DEL VALUE ES: 2025-10-07T14:51:55.023ZY SU TIPO ESstring
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
    // Asegurarse que createdAt siempre tenga valor
    if (!newMessage.createdAt) {
      newMessage.createdAt = new Date();
    }
    console.log(
      'RECIEN CREADO, EL DATE ES:',
      newMessage.createdAt + 'Y SU TIPO ES' + typeof newMessage.createdAt,
    );

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
  @Mutation(() => ChatroomEntity)
  async addUsersToChatroom(
    @Args('chatroomId') chatroomId: number,
    @Args('userIds', { type: () => [Number] }) userIds: number[],
  ) {
    //VER QUE RETORNA ESTO
    return this.chatroomService.addUsersToChatroom(chatroomId, userIds);
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
  @Query(() => [MessageEntity])
  async getMessagesForChatroom(@Args('chatroomId') chatroomId: number) {
    return this.chatroomService.getMessagesForChatroom(chatroomId);
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Mutation(() => String)
  async deleteChatroom(@Args('chatroomId') chatroomId: number) {
    await this.chatroomService.deleteChatroom(chatroomId);
    return 'Chatroom deleted successfully';
  }
}
