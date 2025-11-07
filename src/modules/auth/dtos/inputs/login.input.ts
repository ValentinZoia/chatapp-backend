import { Field, InputType } from '@nestjs/graphql';
import { IsEAN, IsEmail, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class LogInInput {
  @IsNotEmpty()
  @IsEmail()
  @IsString()
  @Field()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Field()
  password: string;
}
