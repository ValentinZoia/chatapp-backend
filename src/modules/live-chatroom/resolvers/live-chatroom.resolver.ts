import {
  Resolver,
  Subscription,
  Mutation,
  Args,
  Context,
} from '@nestjs/graphql';
import { LiveChatroomService } from '../services/live-chatroom.service';
import { PubSub } from 'graphql-subscriptions';
import { UserService } from '@/src/modules/user/services/user.service';
import { Inject, UseGuards } from '@nestjs/common';
import { UserEntity } from '@/src/modules/user/entities/user.entity';
import { GraphqlAuthGuard } from '@/src/modules/auth/guards/auth.guard';
import { ChatroomAccessGuard } from '@/src/modules/auth/guards/chatroom-access.guard';
import type { GraphQLContext } from '@/src/common/interfaces/graphql-context.interface';
import { LOGGER_SERVICE, PUB_SUB } from '@/src/common/constants';
import type { ILogger } from '@/src/common/interfaces/logger.interface';
import { SkipThrottle } from '@nestjs/throttler';

@Resolver()
@SkipThrottle()
export class LiveChatroomResolver {
  private readonly context = 'LiveChatroomResolver';
  constructor(
    @Inject(PUB_SUB) private pubSub: PubSub,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
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
    this.logger.log(
      'New Subscription client connected: liveUsersInChatroom',
      this.context,
    );
    return this.pubSub.asyncIterableIterator(
      `liveUsersInChatroom.${chatroomId}`,
    );
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Mutation(() => Boolean)
  @SkipThrottle()
  async enterChatroom(
    @Args('chatroomId') chatroomId: number,
    @Context() ctx: GraphQLContext,
  ) {
    this.logger.debug('Mutation: enterChatroom', this.context, {
      correlationId: ctx?.correlationId,
      chatroomId,
      userId: ctx?.req.user.sub,
    });
    const user = await this.userService.findUserById(ctx.req.user.sub);
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
      .then(() => {
        this.logger.debug(
          'User enter chatroom status published to Redis',
          this.context,
          {
            correlationId: ctx?.correlationId,
            event: 'USER_ENTER_CHATROOM',
            chatroomId,
            userId: user.id,
          },
        );
      })
      .catch((err) => {
        this.logger.error(
          'Failed to publish user enter chatroom status to Redis',
          err.stack,
          this.context,
          {
            correlationId: ctx?.correlationId,
            event: 'USER_ENTER_CHATROOM',
            chatroomId,
            userId: user.id,
            error: err.message,
          },
        );
      });
    return true;
  }

  @UseGuards(GraphqlAuthGuard, ChatroomAccessGuard)
  @Mutation(() => Boolean)
  @SkipThrottle()
  async leaveChatroom(
    @Args('chatroomId') chatroomId: number,
    @Context() ctx: GraphQLContext,
  ) {
    this.logger.debug('Mutation: leaveChatroom', this.context, {
      correlationId: ctx?.correlationId,
      chatroomId,
      userId: ctx?.req.user.sub,
    });
    const user = await this.userService.findUserById(ctx.req.user.sub);
    await this.liveChatroomService.removeLiveUserFromChatroom(chatroomId, user);
    const liveUsers = await this.liveChatroomService.getLiveUsersForChatroom(
      chatroomId,
    );
    await this.pubSub
      .publish(`liveUsersInChatroom.${chatroomId}`, {
        liveUsers,
        chatroomId,
      })
      .then(() => {
        this.logger.debug(
          'User leave chatroom status published to Redis',
          this.context,
          {
            correlationId: ctx?.correlationId,
            event: 'USER_LEAVE_CHATROOM',
            chatroomId,
            userId: user.id,
          },
        );
      })
      .catch((err) => {
        this.logger.error(
          'Failed to publish user leave chatroom status to Redis',
          err.stack,
          this.context,
          {
            correlationId: ctx?.correlationId,
            event: 'USER_LEAVE_CHATROOM',
            chatroomId,
            userId: user.id,
            error: err.message,
          },
        );
      });

    return true;
  }
}
