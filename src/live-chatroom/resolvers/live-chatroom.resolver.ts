import {
  Resolver,
  Subscription,
  Mutation,
  Args,
  Context,
} from '@nestjs/graphql';
import { LiveChatroomService } from '../services/live-chatroom.service';
import { PubSub } from 'graphql-subscriptions';
import { UserService } from 'src/user/services/user.service';
import { Inject, UseGuards } from '@nestjs/common';
import { UserEntity } from 'src/user/entities/user.entity';
import { GraphqlAuthGuard } from 'src/auth/guards/auth.guard';
import { Request } from 'express';
import { ChatroomAccessGuard } from 'src/auth/guards/chatroom-access.guard';
@Resolver()
export class LiveChatroomResolver {
  constructor(
    @Inject('PUB_SUB') private pubSub: PubSub,
    private readonly liveChatroomService: LiveChatroomService,
    private readonly userService: UserService,
  ) {}
  @Subscription(() => [UserEntity], {
    nullable: true,
    resolve: (value) => value.liveUsers,
    filter: (payload, variables) => {
      return payload.chatroomId === variables.chatroomId;
    },
  })
  liveUsersInChatroom(@Args('chatroomId') chatroomId: number) {
    return this.pubSub.asyncIterableIterator(
      `liveUsersInChatroom.${chatroomId}`,
    );
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Mutation(() => Boolean)
  async enterChatroom(
    @Args('chatroomId') chatroomId: number,
    @Context() context: { req: Request },
  ) {
    const user = await this.userService.findUserById(context.req.user.sub);
    await this.liveChatroomService.addLiveUserToChatroom(chatroomId, user);
    const liveUsers = await this.liveChatroomService
      .getLiveUsersForChatroom(chatroomId)
      .catch((err) => {
        console.log('getLiveUsersForChatroom error', err);
      });

    await this.pubSub
      .publish(`liveUsersInChatroom.${chatroomId}`, {
        liveUsers,
        chatroomId,
      })
      .catch((err) => {
        console.log('pubSub error', err);
      });
    return true;
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Mutation(() => Boolean)
  async leaveChatroom(
    @Args('chatroomId') chatroomId: number,
    @Context() context: { req: Request },
  ) {
    const user = await this.userService.findUserById(context.req.user.sub);
    await this.liveChatroomService.removeLiveUserFromChatroom(chatroomId, user);
    const liveUsers = await this.liveChatroomService.getLiveUsersForChatroom(
      chatroomId,
    );
    await this.pubSub.publish(`liveUsersInChatroom.${chatroomId}`, {
      liveUsers,
      chatroomId,
    });

    return true;
  }
}
