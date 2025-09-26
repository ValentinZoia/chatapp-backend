import { Args, Mutation, Query, Resolver, Context } from '@nestjs/graphql';
import { AuthService } from '../services/auth.service';
import { LogInResponse, RegisterResponse } from '../types/types';
import { RegisterInput } from 'src/auth/dtos/inputs/register.input';
import { type Response, type Request } from 'express';
import { LogInInput } from 'src/auth/dtos/inputs/login.input';
import { BadRequestException } from '@nestjs/common';

@Resolver()
export class AuthResolver {
  constructor(private readonly aurhService: AuthService) {}

  @Mutation(() => RegisterResponse, {
    name: 'register',
    description: 'register user',
  })
  async register(
    @Args('RegisterInput', { type: () => RegisterInput })
    credentials: RegisterInput,
    @Context() context: { res: Response },
  ) {
    return this.aurhService.register(credentials, context.res);
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
