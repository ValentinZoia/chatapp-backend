
import { UpdateUserInput } from '../dtos/update-user.input';
import { UserEntity } from '../entities/user.entity';
import { UserService } from '../services/user.service';
import { Resolver, Query, Mutation, Context, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GraphqlAuthGuard } from 'src/auth/guards/auth.guard';
import { Request } from 'express';
import GraphQLUpload, {
  type FileUpload,
} from 'graphql-upload/GraphQLUpload.mjs';
import { storeImageAndGetUrl } from '@/src/utils/storeImage';

@Resolver()
export class UserResolver {
  constructor(private readonly userService: UserService) { }

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

  // @Query(() => UserEntity, { name: 'findUserBy', description: 'Find user by ' })
  // async findBy(
  //   @Args('key', { type: () => String }) key: keyof CreateUserInput,
  //   @Args('value') value: any,
  // ) {
  //   return this.userService.findUserBy({ key, value });
  // }

  @UseGuards(GraphqlAuthGuard)
  @Mutation(() => UserEntity, {
    name: 'updateUserProfile',
    description: 'Update user profile',
  })
  async updateUserProfile(
    @Args('fullname', { type: () => String }) fullname: string,
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true })
    file: FileUpload,
    @Context() context: { req: Request },
  ) {
    const imageUrl = file ? await storeImageAndGetUrl(file) : null;
    const userId = context.req.user.sub;
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
    @Context() context: { req: Request },
  ) {
    return this.userService.searchUsers(fullname, context.req.user.sub);
  }

  @UseGuards(GraphqlAuthGuard)
  @Query(() => [UserEntity])
  getUsersOfChatroom(@Args('chatroomId') chatroomId: number) {
    return this.userService.getUsersOfChatroom(chatroomId);
  }
}
