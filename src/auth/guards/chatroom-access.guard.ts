import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ChatroomService } from 'src/chatroom/services/chatroom.service';
import { ChatroomAccess } from '@prisma/client';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ErrorManager } from 'src/utils/error.manager';

@Injectable()
export class ChatroomAccessGuard implements CanActivate {
  constructor(private readonly chatroomService: ChatroomService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Obtener request desde el contexto
    const ctx = GqlExecutionContext.create(context);
    // Args del resolver
    const args = ctx.getArgs();

    // El contexto completo (req, res, etc)
    const gqlContext = ctx.getContext();

    // Extraer el chatroomId de los args
    const chatroomId = args.chatroomId;

    // Extraer el userId del request
    const userId = gqlContext.req.user.sub;

    if (chatroomId == null) {
      throw new ErrorManager({
        type: 'FORBIDDEN',
        message: 'No chatroomId provided',
      });
    }
    if (!userId) {
      throw new ErrorManager({
        type: 'FORBIDDEN',
        message: 'No user in request',
      });
    }

    const chatroom = await this.chatroomService.getChatroom(chatroomId);
    if (!chatroom) {
      throw new ErrorManager({
        type: 'FORBIDDEN',
        message: 'Chatroom not found',
      });
    }

    if (chatroom.access === ChatroomAccess.PUBLIC) {
      return true;
    }

    // Si es privado, verificar si el usuario está en la lista de usuarios
    const userIds = chatroom.users?.map((u) => u.id) || [];
    if (userIds.includes(userId)) {
      return true;
    }

    throw new ErrorManager({
      type: 'FORBIDDEN',
      message: 'You do not have access to this chatroom',
    });
  }
}
