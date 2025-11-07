import {
  Catch,
  ArgumentsHost,
  HttpException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import {
  GqlArgumentsHost,
  GqlExceptionFilter,
  GraphQLExecutionContext,
} from '@nestjs/graphql';
import { LOG_CONTEXT, LOGGER_SERVICE } from '../constants/logger.constants';
import type { ILogger } from '../interfaces/logger.interface';
import { GraphQLExecutionInfo } from '../types/graphql-execution.types';
import { GraphQLContext } from '../interfaces/graphql-context.interface';

@Catch(HttpException)
export class GraphQLExceptionFilter implements GqlExceptionFilter {
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const gqlHost = GqlArgumentsHost.create(host);
    const ctx = gqlHost.getContext<GraphQLContext>();
    const info = gqlHost.getInfo<GraphQLExecutionInfo>();
    const response = exception.getResponse();

    const correlationId = ctx?.correlationId;
    const operationName = info?.operation.name;
    const fieldName = info?.fieldName;
    const path = info?.path;

    // Determinar el tipo de error
    const isGraphQLError = exception instanceof GraphQLError;
    const message = exception.message || 'An unexpected error occurred';
    const extensions = isGraphQLError ? exception.extensions : {};

    this.logger.error(
      `GraphQL Error: ${message}`,
      exception.stack,
      LOG_CONTEXT.HTTP,
      {
        correlationId,
        operationName,
        fieldName,
        path: this.formatPath(path),
        errorType: exception.constructor.name,
        extensions,
        ...(process.env.NODE_ENV === 'development' && {
          query: info?.operation?.loc?.source?.body,
        }),
      },
    );

    // Si es error de validación (400), formato limpio
    if (
      exception.getStatus() === 400 ||
      exception instanceof BadRequestException
    ) {
      return new GraphQLError(message, {
        extensions: {
          code: 'VALIDATION_ERROR',
          correlationId,
          timestamp: new Date().toISOString(),
          originalError: exception.message,
          stacktrace: exception.stack,
          errors:
            typeof response === 'object' && response['errors']
              ? response['errors']
              : response,
        },
        path: this.formatPath(path),
      });
    }

    // Error de autenticación (401)
    if (exception.getStatus() === 401) {
      return new GraphQLError('Unauthorized', {
        extensions: {
          code: 'Unauthorized',
          correlationId,
          timestamp: new Date().toISOString(),
          originalError: exception.message,
          stacktrace: exception.stack,
          errors:
            typeof response === 'object' && response['errors']
              ? response['errors']
              : response,
        },
        path: this.formatPath(path),
      });
    }

    // Error de permisos (403)
    // if (exception.getStatus() === 403) {
    //   return new GraphQLError('Forbidden', {
    //     extensions: {
    //       code: 'FORBIDDEN',
    //     },
    //   });
    // }

    // Otros errores
    return new GraphQLError(
      process.env.NODE_ENV === 'production'
        ? 'An error ocurred processing your request'
        : message,
      {
        extensions: {
          code: extensions.code || 'INTERNAL_SERVER_ERROR',
          correlationId,
          timestamp: new Date().toISOString(),
          ...(process.env.NODE_ENV === 'development' && {
            originalError: exception.message,
            stacktrace: exception.stack,
          }),
        },
        path: this.formatPath(path),
      },
    );
  }
  private formatPath(path: any): string[] {
    if (!path) return [];

    const pathArray: string[] = [];
    let current = path;

    while (current) {
      pathArray.unshift(String(current.key));
      current = current.prev;
    }

    return pathArray;
  }
}
