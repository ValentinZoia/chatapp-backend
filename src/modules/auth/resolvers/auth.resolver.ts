import { Args, Mutation, Query, Resolver, Context } from '@nestjs/graphql';
import { AuthService } from '../services/auth.service';
import { LogInResponse, RegisterResponse } from '../types/types';
import { RegisterInput } from '@/src/modules/auth/dtos/inputs/register.input';
import { LogInInput } from '@/src/modules/auth/dtos/inputs/login.input';
import { BadRequestException, Inject } from '@nestjs/common';
import { seconds, SkipThrottle, Throttle } from '@nestjs/throttler';
import type { GraphQLContext } from '@/src/common/interfaces/graphql-context.interface';
import { LOGGER_SERVICE } from '@/src/common/constants/logger.constants';
import type { ILogger } from '@/src/common/interfaces/logger.interface';

@Resolver()
export class AuthResolver {
  private readonly context = 'AuthResolver';
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly aurhService: AuthService,
  ) {}

  @Mutation(() => RegisterResponse, {
    name: 'register',
    description: 'register user',
  })
  @Throttle({ short: { limit: 1, ttl: seconds(3) } }) // RateLimit mas estricto - 1 por 3 segundos
  async register(
    @Args('RegisterInput', { type: () => RegisterInput })
    credentials: RegisterInput,
    @Context() ctx: GraphQLContext,
  ) {
    this.logger.log('Mutation: register', this.context, {
      correlationId: ctx?.correlationId,
      email: credentials.email,
    });
    return this.aurhService.register(credentials, ctx.res);
  }

  @Mutation(() => LogInResponse, { name: 'login', description: 'login user' })
  @Throttle({ short: { limit: 1, ttl: seconds(3) } }) // RateLimit mas estricto - 1 por 3 segundos
  async login(
    @Args('LogInInput', { type: () => LogInInput }) credentials: LogInInput,
    @Context() ctx: GraphQLContext,
  ) {
    this.logger.log('Mutation: login', this.context, {
      correlationId: ctx?.correlationId,
      email: credentials.email,
    });
    return this.aurhService.login(credentials, ctx.res);
  }

  @Mutation(() => String, { name: 'logout', description: 'logout user' })
  @SkipThrottle()
  async logout(@Context() ctx: GraphQLContext) {
    this.logger.log('Mutation: logout', this.context, {
      correlationId: ctx?.correlationId,
      userId: ctx?.userId,
    });
    return this.aurhService.logout(ctx.res);
  }

  @Mutation(() => String, {
    name: 'refreshToken',
    description: 'refresh token',
  })
  @SkipThrottle()
  async refreshToken(@Context() ctx: GraphQLContext) {
    try {
      this.logger.log('Mutation: refreshToken', this.context, {
        correlationId: ctx?.correlationId,
        userId: ctx?.userId,
      });
      return this.aurhService.refreshToken(ctx.req, ctx.res);
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Query(() => String, { name: 'hello', description: 'just return hello' })
  hello() {
    return 'hello brah! u mirin? ';
  }
}
