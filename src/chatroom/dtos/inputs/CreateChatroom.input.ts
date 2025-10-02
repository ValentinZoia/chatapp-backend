import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsArray } from 'class-validator';

@InputType()
export class CreateChatroomInput {
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Name is required.' })
  name: string;
  @IsArray()
  @Field(() => [String])
  userIds: string[];
}
