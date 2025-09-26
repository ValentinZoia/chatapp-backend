import { Field, ObjectType } from '@nestjs/graphql';
import { UserEntity } from 'src/user/entities/user.entity';

@ObjectType()
export class RegisterResponse {
  @Field(() => UserEntity, { nullable: true }) // Assuming User is another ObjectType you have
  user?: UserEntity;
}

@ObjectType()
export class LogInResponse {
  @Field(() => UserEntity)
  user: UserEntity;
}
