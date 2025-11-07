import { ObjectType, Field, Int } from '@nestjs/graphql';
import { ChatroomEntity } from '../../entities/chatroom.entity'; // Tu entity de Chatroom

@ObjectType()
export class SearchChatroomsResult {
  @Field(() => [ChatroomEntity])
  chatrooms: ChatroomEntity[];

  @Field(() => Int)
  totalCount: number;
}
