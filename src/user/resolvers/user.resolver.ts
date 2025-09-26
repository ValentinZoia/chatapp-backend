import { CreateUserInput } from '../dtos/create-user.input';
import { UpdateUserInput } from '../dtos/update-user.input';
import { UserEntity } from '../entities/user.entity';
import { UserService } from '../services/user.service';
import { Resolver, Query, Mutation, Context, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GraphqlAuthGuard } from 'src/auth/guards/auth.guard';
import { createWriteStream } from 'fs'; //para crear un stream de escritura
import { join } from 'path';
import { UpdateUserArgs } from '../dtos/args/updateProfile.args';
import { Request } from 'express';
import * as GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import { v4 as uuidv4 } from 'uuid';

@Resolver()
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => UserEntity, {
    name: 'findUserById',
    description: 'Find user by id',
  })
  async findUserById(@Args('id', { type: () => Int }) id: number) {
    return this.userService.findUserById(id);
  }

  @Query(() => [UserEntity], {
    name: 'findAllUsers',
    description: 'Find all users',
  })
  async findAllUsers() {
    return this.userService.findAllUsers();
  }

  @Query(() => UserEntity, { name: 'findUserBy', description: 'Find user by ' })
  async findBy(
    @Args('key', { type: () => String }) key: keyof CreateUserInput,
    @Args('value') value: any,
  ) {
    return this.userService.findUserBy({ key, value });
  }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => UserEntity, {
    name: 'updateUserProfile',
    description: 'Update user profile',
  })
  async updateUserProfile(
    @Args('updateUserArgs') updateUserArgs: UpdateUserArgs,
    @Context() context: { req: Request },
  ) {
    const { file, fullname } = updateUserArgs;
    const imageUrl = file ? await this.storeImageAndGetUrl(file) : null;
    const userId = context.req.user.sub;
    const data = {
      fullname,
      avatarUrl: imageUrl,
      id: userId,
    } as UpdateUserInput;

    return this.userService.updateUser(data);
  }

  private async storeImageAndGetUrl(file: GraphQLUpload.FileUpload) {
    const { createReadStream, filename } = file;
    const uniqueFilename = `${uuidv4()}_${filename}`;
    const path = join(process.cwd(), 'public', uniqueFilename);
    const imageUrl = `${process.env.APP_URL}/${uniqueFilename}`;
    const stream = createReadStream();
    const out = createWriteStream(path);
    stream.pipe(out);
    return imageUrl;
  }
}
