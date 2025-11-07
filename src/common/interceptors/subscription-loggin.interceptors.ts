import {
  Inject,
  Injectable,
  CallHandler,
  NestInterceptor,
  ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { ILogger } from '../interfaces/logger.interface';
import { LOGGER_SERVICE } from '../constants/logger.constants';
import { GraphQLContext } from '../interfaces/graphql-context.interface';
import { GraphQLExecutionInfo } from '../types/graphql-execution.types';

@Injectable()
export class SubscriptionLoggingInterceptor implements NestInterceptor {
  private readonly loggContext = 'SubscriptionInterceptor';

  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo<GraphQLExecutionInfo>();
    const ctx = gqlContext.getContext<GraphQLContext>();

    const subscriptionName = info?.fieldName || 'unknwon';
    const correlationId = ctx?.correlationId || 'no-correlation';

    //Log cuando se inicia la subscripcion
    this.logger.log(
      `Subscription started: ${subscriptionName}`,
      this.loggContext,
      {
        correlationId,
        subscriptionName,
        timestamp: new Date().toISOString(),
      },
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Log cada vez que se emite un evento
          this.logger.verbose(
            `Event emitted: ${subscriptionName}`,
            this.loggContext,
            {
              correlationId,
              subscriptionName,
              dataSize: JSON.stringify(data).length,
            },
          );
        },
        error: (error) => {
          // Log de errores
          this.logger.error(
            `Subscription error: ${subscriptionName}`,
            error.stack,
            this.loggContext,
            {
              correlationId,
              subscriptionName,
              error: error.message,
            },
          );
        },
        complete: () => {
          // Log cuando se completa/cierra la subscripcion
          this.logger.log(
            `Subscription closed: ${subscriptionName}`,
            this.loggContext,
            {
              correlationId,
              subscriptionName,
            },
          );
        },
      }),
    );
  }
}
