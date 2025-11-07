import { Field, InputType, Int, PartialType } from '@nestjs/graphql';
import { CreateUserInput } from './create-user.input';
import * as GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

@InputType()
export class UpdateUserInput extends PartialType(CreateUserInput) {
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @MinLength(1)
  @Field(() => Int)
  id: number;
}
