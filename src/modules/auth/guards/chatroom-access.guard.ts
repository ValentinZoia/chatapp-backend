import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ChatroomService } from 'src/modules/chatroom/services/chatroom.service';
import { ChatroomAccess } from '@prisma/client';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ErrorManager } from '@/src/common/utils/error.manager';

@Injectable()
export class ChatroomAccessGuard implements CanActivate {
  constructor(private readonly chatroomService: ChatroomService) { }

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

    //si no hay chatroomId, tiro error
    if (chatroomId == null) {
      throw new ErrorManager({
        type: 'FORBIDDEN',
        message: 'No chatroomId provided',
      });
    }

    //si no hay userId, tiro error
    if (!userId) {
      throw new ErrorManager({
        type: 'FORBIDDEN',
        message: 'No user in request',
      });
    }


    //Busco la sala con el chatroomId
    const chatroom = await this.chatroomService.getChatroom(chatroomId);

    //si no hay sala, tiro error
    if (!chatroom) {
      throw new ErrorManager({
        type: 'FORBIDDEN',
        message: 'Chatroom not found',
      });
    }

    //si la sala existe y es publica, te dejo pasar
    if (chatroom.access === ChatroomAccess.PUBLIC) {
      return true;
    }

    // Si es privado, verificar si el usuario está en la lista de usuarios
    const userIds = chatroom.users?.map((u) => u.id) || [];
    //si esta en la lista, te dejo pasar
    if (userIds.includes(userId)) {
      return true;
    }

    // si no esta en la lista, no te dejo pasar
    throw new ErrorManager({
      type: 'FORBIDDEN',
      message: 'You do not have access to this chatroom',
    });
  }
}
