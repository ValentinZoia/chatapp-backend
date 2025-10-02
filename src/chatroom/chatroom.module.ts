import { Module } from '@nestjs/common';
import { ChatroomService } from './services/chatroom.service';
import { ChatroomResolver } from './resolvers/chatroom.resolver';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/services/user.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  providers: [
    ChatroomService,
    ChatroomResolver,
    PrismaService,
    UserService,
    JwtService,
  ],
})
export class ChatroomModule {}
