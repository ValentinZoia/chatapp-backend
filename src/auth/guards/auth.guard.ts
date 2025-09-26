import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { TokenName } from '../constants/tokens.constants';

@Injectable()
export class GraphqlAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  //este metodo se ejecuta cada vez que una ruta protegida por este guard es llamada
  async canActivate(context: ExecutionContext): Promise<boolean> {
    //obtner el contexto de graphql
    const gqlCtx = context.getArgByIndex(2);
    const request: Request = gqlCtx.req;

    //extraer token de la cookie
    const token = this.extractTokenFromCookie(request);

    //si no hay, no pasas
    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      //si hay token, lo verifico y extraigo el payload
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
      });

      //guardo el payload en el request
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies[TokenName.ACCESS];
  }
}
