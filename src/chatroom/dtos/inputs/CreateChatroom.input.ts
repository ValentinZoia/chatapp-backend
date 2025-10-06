import { InputType, Field } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ChatroomAccess } from '@prisma/client';

@InputType()
export class CreateChatroomInput {
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Name is required.' })
  name: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  colorHex: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  image: string;

  @Field()
  @IsNotEmpty()
  @IsEnum(ChatroomAccess)
  access: ChatroomAccess;

  @IsArray()
  @Field(() => [String])
  userIds: string[];
}
