import { Field, InputType, Int, PartialType } from '@nestjs/graphql';
import * as GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserArgs {
  @IsOptional()
  @IsString()
  @Field(() => String)
  fullname: string;

  @IsOptional()
  @Field(() => GraphQLUpload, { nullable: true })
  file: GraphQLUpload.FileUpload;
}
