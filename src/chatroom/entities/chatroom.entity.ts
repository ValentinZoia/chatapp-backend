import { Field, ObjectType, ID, Int } from '@nestjs/graphql';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatroomAccess } from '@prisma/client';

@ObjectType()
export class ChatroomEntity {
  @Field(() => Int, { nullable: true })
  id?: number;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description: string | null;

  @Field({ nullable: true })
  colorHex?: string | null;

  @Field({ nullable: true })
  image?: string | null;

  @Field(() => ChatroomAccess, { defaultValue: ChatroomAccess.PRIVATE })
  access: ChatroomAccess;

  // @Field({ nullable: true })
  // image?: string;

  @Field(() => Int, { nullable: true })
  adminId: number | null;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;

  @Field(() => [UserEntity], { nullable: true }) // array of user IDs
  users?: UserEntity[];

  @Field(() => [MessageEntity], { nullable: true }) // array of message IDs
  messages?: MessageEntity[];
}

@ObjectType()
export class MessageEntity {
  @Field(() => Int, { nullable: true })
  id?: number;

  @Field(() => String, { nullable: true })
  imageUrl: string | null;

  @Field(() => String, { nullable: true })
  content?: string;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;

  @Field(() => ChatroomEntity, { nullable: true }) // array of user IDs
  chatroom?: ChatroomEntity;

  @Field(() => UserEntity, { nullable: true }) // array of user IDs
  user?: UserEntity;
}

@ObjectType()
export class UserTypingEntity {
  @Field(() => UserEntity, { nullable: true })
  user?: UserEntity;

  @Field({ nullable: true })
  chatroomId?: number;
}

@ObjectType()
export class UserStoppedTypingEntity extends UserTypingEntity {}
