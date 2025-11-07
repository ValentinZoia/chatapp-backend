import { UpdateUserInput } from '../dtos/update-user.input';
import { UserEntity } from '../entities/user.entity';
import { UserService } from '../services/user.service';
import { Resolver, Query, Mutation, Context, Args, Int } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { GraphqlAuthGuard } from '@/src/modules/auth/guards/auth.guard';
import GraphQLUpload, {
  type FileUpload,
} from 'graphql-upload/GraphQLUpload.mjs';
import { storeImageAndGetUrl } from '@/src/common/utils/storeImage';
import { LOGGER_SERVICE } from '@/src/common/constants/logger.constants';
import type { ILogger } from '@/src/common/interfaces/logger.interface';
import type { GraphQLContext } from '@/src/common/interfaces/graphql-context.interface';
import { seconds, SkipThrottle, Throttle } from '@nestjs/throttler';

@Resolver()
@Throttle({ short: { limit: 10, ttl: seconds(5) } }) // 10 requests/5s
export class UserResolver {
  private readonly context = 'UserResolver';
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly userService: UserService,
  ) {}

  @Query(() => UserEntity, {
    name: 'findUserById',
    description: 'Find user by id',
  })
  async findUserById(
    @Args('id', { type: () => Int }) id: number,
    @Context() ctx: GraphQLContext,
  ) {
    this.logger.debug('Query: findUserById', this.context, {
      correlationId: ctx?.correlationId,
      userId: id,
    });
    return this.userService.findUserById(id);
  }

  @Query(() => [UserEntity], {
    name: 'findAllUsers',
    description: 'Find all users',
  })
  async findAllUsers(@Context() ctx?: GraphQLContext) {
    this.logger.log('Query: users', this.context, {
      correlationId: ctx?.correlationId,
      hasFilters: false,
    });
    return this.userService.findAllUsers();
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => UserEntity, {
    name: 'updateUserProfile',
    description: 'Update user profile',
  })
  async updateUserProfile(
    @Args('fullname', { type: () => String }) fullname: string,
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true })
    file: FileUpload,
    @Context() ctx: GraphQLContext,
  ) {
    this.logger.log('Mutation: updateUserProfile', this.context, {
      correlationId: ctx?.correlationId,
      fullname,
    });

    const imageUrl = file ? await storeImageAndGetUrl(file) : null;
    const userId = ctx.req.user.sub;
    const data = {
      fullname,
      avatarUrl: imageUrl,
      id: userId,
    } as UpdateUserInput;
    return this.userService.updateUser(data);
  }

  @UseGuards(GraphqlAuthGuard)
  @Query(() => [UserEntity])
  async searchUsers(
    @Args('fullname') fullname: string,
    @Context() context: GraphQLContext,
  ) {
    this.logger.debug('Query: searchUsers', this.context, {
      correlationId: context?.correlationId,
      searchPattern: fullname,
      requestingUserId: context.req.user.sub,
    });
    return this.userService.searchUsers(fullname, context.req.user.sub);
  }

  @UseGuards(GraphqlAuthGuard)
  @Query(() => [UserEntity])
  getUsersOfChatroom(
    @Args('chatroomId') chatroomId: number,
    @Context() ctx: GraphQLContext,
  ) {
    this.logger.debug('Query: getUsersOfChatroom', this.context, {
      correlationId: ctx?.correlationId,
      chatroomId,
      requestingUserId: ctx.req.user.sub,
    });
    return this.userService.getUsersOfChatroom(chatroomId);
  }
}
