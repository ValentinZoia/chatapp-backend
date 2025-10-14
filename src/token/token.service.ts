import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorManager } from 'src/utils/error.manager';
import { verify } from 'jsonwebtoken';

@Injectable()
export class TokenService {
  constructor(private readonly configService: ConfigService) {}

  extractToken(connectionParams: any): string | null {
    return connectionParams?.token || null;
  }

  validateToken(token: string) {
    const refreshTokenSecret = this.configService.get('JWT_REFRESH_SECRET');

    try {
      return verify(token, refreshTokenSecret);
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }
}
