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
import { RedisCacheService } from '@/src/common/cache/services/cache.service';

@Resolver()
@Throttle({ short: { limit: 10, ttl: seconds(5) } }) // 10 requests/5s
export class UserResolver {
  private readonly context = 'UserResolver';
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly userService: UserService,
    private readonly cacheService: RedisCacheService,
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

    const cacheKey = `cache:user:getById:${id}`;
    const cached = await this.cacheService.get<UserEntity>(cacheKey);
    if (cached) {
      this.logger.log('Cache hit findUserById', this.context, { userId: id });
      return cached;
    }

    const result = await this.userService.findUserById(id);
    if (result) {
      await this.cacheService.set(cacheKey, result, 60); // 60 seg
    }
    return result;
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

    const cacheKey = `cache:user:all`;
    const cached = await this.cacheService.get<UserEntity[]>(cacheKey);
    if (cached) {
      this.logger.log('Cache hit findAllUsers', this.context, {});
      return cached;
    }

    const result = await this.userService.findAllUsers();
    if (result && result.length > 0) {
      await this.cacheService.set(cacheKey, result, 60); // 60 seg
    }
    return result;
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

    const result = await this.userService.updateUser(data);

    // Invalidar cache del usuario actualizado
    const userCacheKey = `cache:user:getById:${userId}`;
    await this.cacheService.del(userCacheKey);

    // Invalidar cache de todos los usuarios
    const allUsersKey = `cache:user:all`;
    await this.cacheService.del(allUsersKey);

    // Invalidar todos los cachés de búsqueda de usuarios (pueden retornar este usuario)
    const userSearchPattern = `cache:user:search:*`;
    await this.cacheService.delByPattern(userSearchPattern);

    // Invalidar listados de usuarios de chatrooms (el avatar cambió)
    const chatroomUsersPattern = `cache:chatroom:*:users`;
    await this.cacheService.delByPattern(chatroomUsersPattern);

    this.logger.debug('Cache invalidated for updated user', this.context, {
      userId,
      invalidatedKeys: [
        userCacheKey,
        allUsersKey,
        userSearchPattern,
        chatroomUsersPattern,
      ],
    });

    return result;
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

    // Normalizar el término de búsqueda para la clave
    const normalizedSearch = encodeURIComponent(fullname.trim().toLowerCase());
    const cacheKey = `cache:user:search:${normalizedSearch}`;

    const cached = await this.cacheService.get<UserEntity[]>(cacheKey);
    if (cached) {
      this.logger.log('Cache hit searchUsers', this.context, {
        searchTerm: fullname,
      });
      return cached;
    }

    const result = await this.userService.searchUsers(
      fullname,
      context.req.user.sub,
    );
    if (result && result.length > 0) {
      await this.cacheService.set(cacheKey, result, 30); // 30 seg, búsquedas son menos estables
    }
    return result;
  }

  @UseGuards(GraphqlAuthGuard)
  @Query(() => [UserEntity])
  async getUsersOfChatroom(
    @Args('chatroomId') chatroomId: number,
    @Context() ctx: GraphQLContext,
  ) {
    this.logger.debug('Query: getUsersOfChatroom', this.context, {
      correlationId: ctx?.correlationId,
      chatroomId,
      requestingUserId: ctx.req.user.sub,
    });

    const cacheKey = `cache:chatroom:${chatroomId}:users`;
    const cached = await this.cacheService.get<UserEntity[]>(cacheKey);
    if (cached) {
      this.logger.log('Cache hit getUsersOfChatroom', this.context, {
        chatroomId,
      });
      return cached;
    }

    const result = await this.userService.getUsersOfChatroom(chatroomId);
    if (result && result.length > 0) {
      await this.cacheService.set(cacheKey, result, 30); // 30 seg, lista de usuarios puede cambiar
    }
    return result;
  }
}
