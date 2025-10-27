import { Field, ObjectType, ID, Int, registerEnumType } from '@nestjs/graphql';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatroomAccess } from '@prisma/client';

registerEnumType(ChatroomAccess, {
  name: 'ChatroomAccess', // este nombre aparecerá en el schema
  description: 'Tipos de acceso de la sala de chat',
});

@ObjectType()
export class ChatroomEntity {
  @Field(() => Int, { nullable: true })
  id?: number;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  colorHex?: string | null;

  @Field(() => String, { nullable: true })
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
  @Field(() => Int)
  id: number;

  @Field(() => String, { nullable: true })
  imageUrl: string | null;

  @Field(() => String)
  content: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date;

  @Field(() => ChatroomEntity, { nullable: true }) // array of user IDs
  chatroom?: ChatroomEntity | null;

  @Field(() => UserEntity) // array of user IDs
  user: Omit<UserEntity, "password"> | null;
}

@ObjectType()
export class UserTypingEntity {
  @Field(() => UserEntity, { nullable: true })
  user?: UserEntity;

  @Field({ nullable: true })
  chatroomId?: number;
}

@ObjectType()
export class UserStoppedTypingEntity extends UserTypingEntity { }
