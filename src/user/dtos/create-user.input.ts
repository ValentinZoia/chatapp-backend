import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateUserInput {
  @IsNotEmpty()
  @IsString()
  @Field(() => String)
  fullname: string;

  @IsNotEmpty()
  @IsString()
  @Field(() => String)
  email: string;

  @IsNotEmpty()
  @IsString()
  @Field(() => String)
  avatarUrl: string;

  @IsNotEmpty()
  @IsString()
  @Field(() => String)
  password: string;
}
