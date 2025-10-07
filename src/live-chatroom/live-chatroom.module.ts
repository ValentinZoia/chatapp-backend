import { Module } from '@nestjs/common';
import { LiveChatroomService } from './services/live-chatroom.service';
import { LiveChatroomResolver } from './resolvers/live-chatroom.resolver';
import { UserService } from 'src/user/services/user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ChatroomService } from 'src/chatroom/services/chatroom.service';

@Module({
  providers: [
    LiveChatroomService,
    LiveChatroomResolver,
    UserService,
    PrismaService,
    JwtService,
    ChatroomService,
  ],
})
export class LiveChatroomModule {}
