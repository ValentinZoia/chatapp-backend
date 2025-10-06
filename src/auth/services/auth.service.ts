import {
  BadRequestException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogInResponse, RegisterResponse } from '../types/types';
import { Request, Response } from 'express';
import { TokenName } from '../constants/tokens.constants';
import { JwtPayload } from '../interfaces/jwt.payload.interface';
import { UserEntity } from 'src/user/entities/user.entity';
import { LogInInput } from 'src/auth/dtos/inputs/login.input';
import * as bcrypt from 'bcrypt';
import { RegisterInput } from 'src/auth/dtos/inputs/register.input';
import { ErrorManager } from 'src/utils/error.manager';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    credentials: RegisterInput,
    response: Response,
  ): Promise<RegisterResponse> {
    try {
      if (credentials.password !== credentials.confirmPassword) {
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Passwords do not match',
        });
      }

      const existingUser = await this.prisma.user.findUnique({
        where: {
          email: credentials.email,
        },
      });
      if (existingUser) {
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Email already exists',
        });
      }
      const hashedPassword = await bcrypt.hash(credentials.password, 10);
      const user = await this.prisma.user.create({
        data: {
          fullname: credentials.fullname,
          email: credentials.email,
          password: hashedPassword,
        },
      });
      return this.issueTokens(user, response);
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async login(
    credentials: LogInInput,
    response: Response,
  ): Promise<LogInResponse> {
    try {
      const user = await this.validateUser(credentials);
      if (!user) {
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Invalid credentials',
        });
      }
      //3 - create token
      return this.issueTokens(user, response);
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async logout(response: Response): Promise<string> {
    try {
      response.clearCookie(TokenName.ACCESS);
      response.clearCookie(TokenName.REFRESH);

      return 'Successfully logged out';
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      // 1 - get refresh token from the cookie
      const refreshToken = req.cookies[TokenName.REFRESH];

      if (!refreshToken) {
        throw new ErrorManager({
          type: 'UNAUTHORIZED',
          message: 'Refresh token not found',
        });
      }

      // 2 - validate  the token
      let payload: JwtPayload;
      try {
        payload = this.jwtService.verify(refreshToken, {
          secret: this.configService.get('JWT_REFRESH_SECRET'),
        });
      } catch (error) {
        throw new ErrorManager({
          type: 'UNAUTHORIZED',
          message: 'Invalid or expired refresh token',
        });
      }

      // 3 - check if the user exists
      const userExists = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!userExists) {
        throw new ErrorManager({
          type: 'UNAUTHORIZED',
          message: 'User no longer exists',
        });
      }

      // 4 - create new access token
      const expiresIn = 15000;
      const expiration = Math.floor(Date.now() / 1000) + expiresIn;

      const accessToken = this.jwtService.sign(
        { ...payload, exp: expiration },
        {
          secret: this.configService.get('JWT_ACCESS_SECRET'),
        },
      );

      // 5 - then set the cookie with the new access token
      res.cookie(TokenName.ACCESS, accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Solo en HTTPS en producción
        sameSite: 'strict',
        maxAge: expiresIn,
      });

      return accessToken;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  private async issueTokens(user: UserEntity, res: Response) {
    const payload: JwtPayload = { sub: user.id, username: user.fullname };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: '3h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: '7d',
    });

    res.cookie(TokenName.ACCESS, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Solo en HTTPS en producción
      sameSite: 'strict',
    });

    res.cookie(TokenName.REFRESH, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Solo en HTTPS en producción
      sameSite: 'strict',
    });

    return { user };
  }

  private async validateUser(credentials: LogInInput) {
    try {
      // 1 - verify user exists
      const userExists = await this.prisma.user.findUnique({
        where: {
          email: credentials.email,
        },
      });

      if (!userExists) {
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Invalid credentials',
        });
      }

      //2 - verify password match
      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        userExists.password,
      );

      if (!isPasswordValid) {
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Invalid credentials',
        });
      }

      return userExists;
    } catch (error) {
      throw ErrorManager.createSignatureError(error.message);
    }
  }
}
