import { ObjectType, Field, Int } from '@nestjs/graphql';
import { MessageEntity } from 'src/chatroom/entities/chatroom.entity';

@ObjectType()
export class MessageEdge {
  @Field(() => MessageEntity)
  node: MessageEntity;

  @Field(() => Int)
  cursor: number;
}

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field(() => Int, { nullable: true })
  endCursor: number | null;
}

@ObjectType()
export class PaginatedMessage {
  @Field(() => [MessageEdge])
  edges: MessageEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}
