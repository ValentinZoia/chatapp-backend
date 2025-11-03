import { Args, Mutation, Query, Resolver, Context } from '@nestjs/graphql';
import { AuthService } from '../services/auth.service';
import { LogInResponse, RegisterResponse } from '../types/types';
import { RegisterInput } from 'src/auth/dtos/inputs/register.input';
import { type Response, type Request } from 'express';
import { LogInInput } from 'src/auth/dtos/inputs/login.input';
import { BadRequestException } from '@nestjs/common';
import { Res } from '../decorators/response.decorator';
import { seconds, Throttle } from '@nestjs/throttler';

@Resolver()
export class AuthResolver {
  constructor(private readonly aurhService: AuthService) { }

  @Mutation(() => RegisterResponse, {
    name: 'register',
    description: 'register user',
  })
  @Throttle({ short: { limit: 1, ttl: seconds(5) } }) // RateLimit mas estricto - 1 por 5 segundos
  async register(
    @Args('RegisterInput', { type: () => RegisterInput })
    credentials: RegisterInput,
    @Res() res: Response,
  ) {
    return this.aurhService.register(credentials, res);
  }

  @Mutation(() => LogInResponse, { name: 'login', description: 'login user' })
  async login(
    @Args('LogInInput', { type: () => LogInInput }) credentials: LogInInput,
    @Context() context: { res: Response },
  ) {
    return this.aurhService.login(credentials, context.res);
  }

  @Mutation(() => String, { name: 'logout', description: 'logout user' })
  async logout(@Context() context: { res: Response }) {
    return this.aurhService.logout(context.res);
  }

  @Mutation(() => String, {
    name: 'refreshToken',
    description: 'refresh token',
  })
  async refreshToken(@Context() context: { req: Request; res: Response }) {
    try {
      return this.aurhService.refreshToken(context.req, context.res);
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Query(() => String, { name: 'hello', description: 'just return hello' })
  hello() {
    return 'hello brah! u mirin? ';
  }
}
