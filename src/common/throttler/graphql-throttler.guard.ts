import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerRequest,
  type ThrottlerModuleOptions,
  ThrottlerStorageService,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { CONTEXT, GqlExecutionContext } from '@nestjs/graphql';
import { type ILogger } from '../interfaces/logger.interface';
import { LOGGER_SERVICE } from '../constants/logger.constants';
import { GraphQLContext } from '../interfaces/graphql-context.interface';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { GraphQLExecutionInfo } from '../types/graphql-execution.types';

@Injectable()
export class GraphQLThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    @InjectThrottlerOptions()
    protected readonly options: ThrottlerModuleOptions,
    @InjectThrottlerStorage()
    protected readonly storageService: ThrottlerStorage,
    protected readonly reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Sobrescribir para obtener request/response de GraphQL context
   */
  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);

    // El contexto completo (req, res, etc)
    // const ctx = gqlCtx.getContext<GraphQLContext>();
    const ctx = gqlCtx.getContext<GraphQLContext>();

    return { req: ctx.req, res: ctx.res };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlCtx = GqlExecutionContext.create(context);
    const info = gqlCtx.getInfo();

    // Verificar si es una subscription
    const operationType = info?.operation?.operation;

    if (operationType === 'subscription') {
      const subscriptionName = info?.fieldName || 'unknown';

      this.logger.debug(
        `Skipping throttle for subscription: ${subscriptionName}`,
        'GraphQLThrottlerGuard',
        {
          operationType,
          subscriptionName,
        },
      );

      //  NO aplicar rate limiting a subscriptions
      return true;
    }

    // Para queries y mutations, aplicar throttling normal
    return super.canActivate(context);
  }
  /**
   * Generar un identificador único para el tracking
   * Por defecto usa IP, pero se puede customizar
   */
  async getTracker(req: Request, user_Id?: string | number): Promise<string> {
    const ip =
      req.ip ||
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      'unknown';
    const userId =
      user_Id?.toString() ||
      (req.user && typeof req.user.sub !== 'undefined'
        ? req.user.sub.toString()
        : undefined) ||
      req.headers['x-user-id'] ||
      'anonymous';

    // Combinar IP + userId para tracking más preciso
    return `${ip}:${userId}`;
  }

  /**
   * Hook que se ejecuta ANTES de verificar el throttle
   */
  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration } = requestProps;
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext<GraphQLContext>();
    const info = gqlCtx.getInfo<GraphQLExecutionInfo>();

    // Verificar si el resolver tiene @SkipThrottle()
    const skip = this.reflector.getAllAndOverride<boolean>('skip_throttler', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      this.logger.verbose(
        `Throttle skipped for ${info?.operation?.name?.value || 'unknown'}`,
        'ThrottlerGuard',
      );
      return true;
    }

    // Para subscriptions: las ignoramos totalmente
    if (info?.operation?.operation === 'subscription') {
      this.logger.verbose(
        `Throttle ignored for subscription ${info?.operation?.name?.value}`,
        'ThrottlerGuard',
      );
      return true;
    }

    const operationName = info?.operation?.name?.value || 'anonymous';
    const operationType = info?.operation?.operation || 'unknown';
    const correlationId = ctx?.correlationId || 'no-correlation';
    const tracker = await this.getTracker(ctx.req, ctx.userId);

    // Log de intento de request
    this.logger.verbose(
      `Throttle check: ${operationType} ${operationName}`,
      'ThrottlerGuard',
      {
        correlationId,
        tracker,
        operationName,
        operationType,
        limit,
        ttl,
      },
    );

    try {
      // Ejecutar la lógica de throttling del padre
      const requestProps: ThrottlerRequest = {
        context,
        limit,
        ttl,
        throttler,
        blockDuration,
        getTracker: () => tracker,
        generateKey: () => `${operationType}:${operationName}:${tracker}`,
      };
      const result = await super.handleRequest(requestProps);

      // Log exitoso (solo en modo verbose)

      this.logger.verbose('Throttle check passed', 'ThrottlerGuard', {
        correlationId,
        tracker,
        operationName,
      });

      return result;
    } catch (error) {
      // Capturar cuando se excede el límite
      if (error instanceof ThrottlerException) {
        this.logger.warn(
          `Rate limit exceeded for ${operationType} ${operationName}`,
          'ThrottlerGuard',
          {
            correlationId,
            tracker,
            operationName,
            operationType,
            limit,
            ttl,
            message: error.message,
          },
        );
      } else {
        // Otro tipo de error
        this.logger.error(
          `Throttle check error: ${error.message}`,
          error.stack,
          'ThrottlerGuard',
          {
            correlationId,
            tracker,
            operationName,
          },
        );
      }

      throw error;
    }
  }

  /**
   * Customizar el mensaje de error
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
  ): Promise<void> {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext<GraphQLContext>();

    const info = gqlCtx.getInfo<GraphQLExecutionInfo>();

    const operationName = info?.operation?.name?.value || 'anonymous';

    this.logger.error(
      `Throwing throttling exception for: ${operationName}`,
      undefined,
      'ThrottlerGuard',
      {
        correlationId: ctx?.correlationId,
        operationName,
      },
    );

    // Mensaje personalizado
    throw new ThrottlerException('Too many requests. Please try again later.');
  }
}
