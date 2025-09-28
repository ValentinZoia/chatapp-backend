import {
  Catch,
  ArgumentsHost,
  HttpException,
  ExceptionFilter,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';

@Catch(HttpException)
export class GraphQLExceptionFilter implements GqlExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const gqlHost = GqlArgumentsHost.create(host);
    const response = exception.getResponse();

    // Si es error de validación (400), formato limpio
    if (exception.getStatus() === 400) {
      return new GraphQLError(exception.message, {
        extensions: {
          code: 'VALIDATION_ERROR',
          errors:
            typeof response === 'object' && response['errors']
              ? response['errors']
              : response,
        },
      });
    }

    // Error de autenticación (401)
    if (exception.getStatus() === 401) {
      return new GraphQLError('Unauthorized', {
        extensions: {
          code: 'UNAUTHENTICATED',
        },
      });
    }

    // Error de permisos (403)
    if (exception.getStatus() === 403) {
      return new GraphQLError('Forbidden', {
        extensions: {
          code: 'FORBIDDEN',
        },
      });
    }

    // Otros errores
    return new GraphQLError(exception.message, {
      extensions: {
        code: `HTTP_${exception.getStatus()}`,
      },
    });
  }
}
