import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException, ThrottlerRequest } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';
// import { ILogger } from '../interfaces/logger.interface';
// import { LOGGER_SERVICE } from '../constants/logger.constants';
// import { GraphQLContext } from '../interfaces/graphql-context.interface';

@Injectable()
export class GraphQLThrottlerGuard extends ThrottlerGuard {
  // constructor(
  //   @Inject(LOGGER_SERVICE)
  //   private readonly logger: ILogger,
  // ) {
  //   super();
  // }

  /**
   * Sobrescribir para obtener request/response de GraphQL context
   */
  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);

    // El contexto completo (req, res, etc)
    // const ctx = gqlCtx.getContext<GraphQLContext>();
    const ctx = gqlCtx.getContext();
    return { req: ctx.req, res: ctx.res };
  }

  /**
   * Generar un identificador único para el tracking
   * Por defecto usa IP, pero se puede customizar
   */
  async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userId =
      // req.user.id ||
      req.headers['x-user-id'] ||
      'anonymous';

    // Combinar IP + userId para tracking más preciso
    return `${ip}:${userId}`;
  }

  /**
   * Hook que se ejecuta ANTES de verificar el throttle
   */
  protected async handleRequest(
    // context: ExecutionContext,
    // limit: number,
    // ttl: number,
    // throttler: any,
    requestProps: ThrottlerRequest
  ): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, } = requestProps;
    const gqlCtx = GqlExecutionContext.create(context);
    // const ctx = gqlCtx.getContext<GraphQLContext>();
    const ctx = gqlCtx.getContext();
    const info = gqlCtx.getInfo();

    const operationName = info?.operation?.name?.value || 'anonymous';
    const operationType = info?.operation?.operation || 'unknown';
    const correlationId = ctx?.correlationId || 'no-correlation';
    const tracker = await this.getTracker(ctx.req);

    // Log de intento de request
    console.log(`Throttle check: ${operationType} ${operationName}`, {
      correlationId,
      tracker,
      operationName,
      operationType,
      limit,
      ttl,
    });
    // this.logger.verbose(
    //   `Throttle check: ${operationType} ${operationName}`,
    //   'ThrottlerGuard',
    //   {
    //     correlationId,
    //     tracker,
    //     operationName,
    //     operationType,
    //     limit,
    //     ttl,
    //   },
    // );

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
      console.log('Throttle check passed', {
        correlationId,
        tracker,
        operationName,
      });
      // this.logger.verbose(
      //   'Throttle check passed',
      //   'ThrottlerGuard',
      //   {
      //     correlationId,
      //     tracker,
      //     operationName,
      //   },
      // );

      return result;
    } catch (error) {
      // Capturar cuando se excede el límite
      if (error instanceof ThrottlerException) {
        console.log(`Rate limit exceeded for ${operationType} ${operationName}`)
        // this.logger.warn(
        //   `Rate limit exceeded for ${operationType} ${operationName}`,
        //   'ThrottlerGuard',
        //   {
        //     correlationId,
        //     tracker,
        //     operationName,
        //     operationType,
        //     limit,
        //     ttl,
        //     message: error.message,
        //   },
        // );
      } else {
        // Otro tipo de error
        console.log(`Throttle check error: ${error.message}`)
        // this.logger.error(
        //   `Throttle check error: ${error.message}`,
        //   error.stack,
        //   'ThrottlerGuard',
        //   {
        //     correlationId,
        //     tracker,
        //     operationName,
        //   },
        // );
      }

      throw error;
    }
  }

  /**
   * Customizar el mensaje de error
   */
  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const gqlCtx = GqlExecutionContext.create(context);
    // const ctx = gqlCtx.getContext<GraphQLContext>();
    const ctx = gqlCtx.getContext();
    const info = gqlCtx.getInfo();

    const operationName = info?.operation?.name?.value || 'anonymous';

    console.log(`Throwing throttling exception for: ${operationName}`);
    // this.logger.error(
    //   `Throwing throttling exception for: ${operationName}`,
    //   undefined,
    //   'ThrottlerGuard',
    //   {
    //     correlationId: ctx?.correlationId,
    //     operationName,
    //   },
    // );

    // Mensaje personalizado
    throw new ThrottlerException(
      'Too many requests. Please try again later.',
    );
  }
}
