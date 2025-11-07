import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Exclude } from 'class-transformer';

@ObjectType()
export class UserEntity {
  @Field(() => Int)
  id: number;

  @Field(() => String)
  fullname: string;

  @Field(() => String)
  email?: string;

  @Field(() => String, { nullable: true })
  avatarUrl: string | null;

  @Exclude() // no devolver el password en ninguna solicitud
  @Field(() => String, { nullable: true })
  password?: string;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;
}
