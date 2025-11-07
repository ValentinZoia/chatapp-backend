import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/src/common/prisma/prisma.service';
import { LogInResponse, RegisterResponse } from '../types/types';
import { Request, Response } from 'express';
import { TokenName } from '../constants/tokens.constants';
import { JwtPayload } from '../interfaces/jwt.payload.interface';
import { UserEntity } from '@/src/modules/user/entities/user.entity';
import { LogInInput } from '@/src/modules/auth/dtos/inputs/login.input';
import * as bcrypt from 'bcrypt';
import { RegisterInput } from '@/src/modules/auth/dtos/inputs/register.input';
import { ErrorManager } from '@/src/common/utils/error.manager';
import type { ILogger } from '@/src/common/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@/src/common/constants/logger.constants';

@Injectable()
export class AuthService {
  private readonly context = 'AuthService';
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    credentials: RegisterInput,
    response: Response,
  ): Promise<RegisterResponse> {
    const startTime = Date.now();
    try {
      this.logger.log('Processing user registration', this.context, {
        email: credentials.email,
        fullname: credentials.fullname,
      });

      // 1 - Verificar que coincidan las contraseñas
      if (credentials.password !== credentials.confirmPassword) {
        const duration = Date.now() - startTime;
        this.logger.warn('Password mismatch in registration', this.context, {
          email: credentials.email,
          duration,
        });
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Passwords do not match',
        });
      }

      // 2 - Validar que no exista otro usuario con el mismo email o fullname
      const existingEmailUser = await this.prisma.user.findUnique({
        where: {
          email: credentials.email,
        },
      });
      if (existingEmailUser) {
        const duration = Date.now() - startTime;
        this.logger.warn(
          'Attempted registration with existing email',
          this.context,
          {
            email: credentials.email,
            duration,
          },
        );
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Email already exists',
        });
      }

      const existingFullNameUser = await this.prisma.user.findUnique({
        where: {
          fullname: credentials.fullname,
        },
      });
      if (existingFullNameUser) {
        const duration = Date.now() - startTime;
        this.logger.warn(
          'Attempted registration with existing fullname',
          this.context,
          {
            fullname: credentials.fullname,
            duration,
          },
        );
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'FullName already exists',
        });
      }

      // 3 - Hashear la contraseña
      const hashedPassword = await bcrypt.hash(credentials.password, 10);

      // 4 - Crear el usuario
      const user = await this.prisma.user.create({
        data: {
          fullname: credentials.fullname,
          email: credentials.email,
          password: hashedPassword,
        },
      });

      //5 - Crear tokens y establecer cookies
      const result = await this.issueTokens(user, response);

      const duration = Date.now() - startTime;
      this.logger.log('User registered successfully', this.context, {
        userId: user.id,
        email: user.email,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Registration failed: ${error.message}`,
        error.stack,
        this.context,
        {
          email: credentials.email,
          fullname: credentials.fullname,
          duration,
        },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async login(
    credentials: LogInInput,
    response: Response,
  ): Promise<LogInResponse> {
    const startTime = Date.now();
    try {
      this.logger.log('Processing login attempt', this.context, {
        email: credentials.email,
      });

      // 1 - Validar que exista el usuario y la contraseña sea correcta
      const user = await this.validateUser(credentials);
      if (!user) {
        const duration = Date.now() - startTime;
        this.logger.warn('Invalid credentials provided', this.context, {
          email: credentials.email,
          duration,
        });
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Invalid credentials',
        });
      }

      //3 - create token
      const result = await this.issueTokens(user, response);

      const duration = Date.now() - startTime;
      this.logger.log('User logged in successfully', this.context, {
        userId: user.id,
        email: user.email,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Login failed: ${error.message}`,
        error.stack,
        this.context,
        {
          email: credentials.email,
          duration,
        },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async logout(response: Response): Promise<string> {
    const startTime = Date.now();
    try {
      this.logger.debug('Processing logout request', this.context);

      // 1 - Limpiar las cookies
      response.clearCookie(TokenName.ACCESS);
      response.clearCookie(TokenName.REFRESH);

      const duration = Date.now() - startTime;
      this.logger.log('User logged out successfully', this.context, {
        duration,
      });

      return 'Successfully logged out';
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Logout failed: ${error.message}`,
        error.stack,
        this.context,
        { duration },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  async refreshToken(req: Request, res: Response) {
    const startTime = Date.now();
    try {
      this.logger.debug('Processing token refresh request', this.context);

      // 1 - get refresh token from the cookie
      const refreshToken = req.cookies[TokenName.REFRESH];

      if (!refreshToken) {
        const duration = Date.now() - startTime;
        this.logger.warn('Refresh token not found in cookies', this.context, {
          duration,
        });
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
        const duration = Date.now() - startTime;
        this.logger.warn('Invalid or expired refresh token', this.context, {
          duration,
        });
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
        const duration = Date.now() - startTime;
        this.logger.warn('User no longer exists', this.context, {
          userId: payload.sub,
          duration,
        });
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

      const duration = Date.now() - startTime;
      this.logger.log('Access token refreshed successfully', this.context, {
        userId: payload.sub,
        duration,
      });

      return accessToken;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Token refresh failed: ${error.message}`,
        error.stack,
        this.context,
        { duration },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  private async issueTokens(user: UserEntity, res: Response) {
    const startTime = Date.now();
    try {
      this.logger.debug('Generating authentication tokens', this.context, {
        userId: user.id,
      });

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

      const duration = Date.now() - startTime;
      this.logger.debug(
        'Authentication tokens generated successfully',
        this.context,
        {
          userId: user.id,
          duration,
        },
      );

      return { user };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to generate tokens: ${error.message}`,
        error.stack,
        this.context,
        {
          userId: user.id,
          duration,
        },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }

  private async validateUser(credentials: LogInInput) {
    const startTime = Date.now();
    try {
      this.logger.debug('Validating user credentials', this.context, {
        email: credentials.email,
      });

      // 1 - verify user exists
      const userExists = await this.prisma.user.findUnique({
        where: {
          email: credentials.email,
        },
      });

      if (!userExists) {
        const duration = Date.now() - startTime;
        this.logger.warn('User not found during validation', this.context, {
          email: credentials.email,
          duration,
        });
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
        const duration = Date.now() - startTime;
        this.logger.warn('Invalid password during validation', this.context, {
          email: credentials.email,
          duration,
        });
        throw new ErrorManager({
          type: 'BAD_REQUEST',
          message: 'Invalid credentials',
        });
      }

      const duration = Date.now() - startTime;
      this.logger.debug(
        'User credentials validated successfully',
        this.context,
        {
          userId: userExists.id,
          email: userExists.email,
          duration,
        },
      );

      return userExists;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `User validation failed: ${error.message}`,
        error.stack,
        this.context,
        {
          email: credentials.email,
          duration,
        },
      );
      throw ErrorManager.createSignatureError(error.message);
    }
  }
}
