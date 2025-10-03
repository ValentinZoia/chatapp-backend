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
    console.log('TU TOKEN DESDE EL BACKEND', token);

    //si no hay, no pasas
    if (!token) {
      console.log('NO PASAS CRACK');
      throw new UnauthorizedException();
    }

    try {
      console.log('ESTE ES EL TOKEN', token);
      console.log('SECRETO', this.configService.get('JWT_ACCESS_SECRET'));
      //si hay token, lo verifico y extraigo el payload
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
      });
      console.log('ESTE ES EL PAYLOAD CRACK', payload);
      //guardo el payload en el request
      request['user'] = payload;
    } catch {
      console.log('OCURRIO UN ERROR CON EL PAYLOAD PERRO');
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies[TokenName.ACCESS];
  }
}
