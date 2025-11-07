import { ApolloServerPlugin, GraphQLRequestListener, GraphQLRequestContext, BaseContext } from "@apollo/server";
import { Plugin } from "@nestjs/apollo";
import { Inject, Injectable } from '@nestjs/common'
import type { ILogger } from "../interfaces/logger.interface";
import { LOGGER_SERVICE, LOG_CONTEXT } from "../constants/logger.constants";
import { GraphQLError } from "graphql";
import { GraphQLContext } from '../interfaces/graphql-context.interface'


/*
 **Plugin (Apollo/GraphQL Layer)**
 Cliente → GraphQL Server → Plugin → Resolvers
                          ↑
                          Entiende GraphQL completamente

✅ Se ejecuta dentro del ciclo de vida de GraphQL
✅ Acceso al AST (Abstract Syntax Tree) de la query
✅ Sabe qué operación se ejecuta (GetUsers, CreatePost, etc.)
✅ Ve cada resolver individual y su tiempo de ejecución
✅ Captura errores de GraphQL específicos (parsing, validation, execution)
✅ Acceso a variables, argumentos, contexto
✅ Hook points específicos: parsing, validation, execution, willSendResponse

El Plugin tiene acceso a 8 momentos clave.
requestDidStart() {
  return {
    parsingDidStart(),      // 1. Parseando la query
    validationDidStart(),   // 2. Validando contra el schema
    executionDidStart() {   // 3. Ejecutando
      return {
        willResolveField(), // 4. Antes de cada resolver
        // 5. Después de cada resolver (return)
      }
    },
    didEncounterErrors(),   // 6. Errores inesperados
    willSendResponse(),     // 7. Antes de enviar respuesta
    didResolveOperation(),  // 8. Operación resuelta
  }
}

*/

@Injectable()
@Plugin()
export class LogginPlugin implements ApolloServerPlugin {
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) { }


  async requestDidStart(requestContext: GraphQLRequestContext<GraphQLContext>): Promise<void | GraphQLRequestListener<GraphQLContext>> {
    // Ignorar introspection queries
    if (requestContext.request.operationName === 'IntrospectionQuery') {
      return {};
    }
    const startTime = Date.now();
    const correlationId = requestContext.contextValue?.correlationId;
    const operationName = requestContext.request.operationName;
    const query = requestContext.request.query;

    // Capturar referencias que usaremos dentro de los callbacks (evita pérdida de `this`)
    const logger = this.logger;
    const sanitizeQuery = this.sanitizeQuery.bind(this);
    const sanitizeArgs = this.sanitizeArgs.bind(this);
    const formatPath = this.formatPath.bind(this);

    // Log inicial de la request
    logger.log('GraphQL request started', LOG_CONTEXT.HTTP, {
      correlationId,
      operationName,
      query: sanitizeQuery(query),
    });


    // recordemos el flujo, primero parsea la query.

    return {


      //1-  se ejecuta cuando termina el parsing
      async parsingDidStart() {

        return async (err) => {
          if (err) {
            logger.error('GraphQL parsing error',
              err.stack,
              LOG_CONTEXT.HTTP,
              {
                correlationId,
                error: err.message,
              },)
          }
        }
      },

      //2 - se ejecuta cuando termina la validación
      async validationDidStart() {
        return async (errs) => {
          if (errs && errs.length > 0) {
            logger.warn('GraphQL validation errors', LOG_CONTEXT.HTTP, {
              correlationId,
              errors: errs.map((e) => e.message)
            })
          }
        }
      },

      //3 - se ejecuta antes de la ejecución
      async executionDidStart() {
        return {
          // Logging de cada resolver individual - se ejecuta antes de cada resolver
          willResolveField({ source, args, contextValue, info }) {
            const fieldStartTime = Date.now();


            return (error, result) => {
              const fieldDuration = Date.now() - fieldStartTime;
              const fieldPath = info.path ? formatPath(info.path) : 'unknown';

              if (error) {
                logger.warn(
                  `Resolver error: ${info.parentType.name}.${info.fieldName}`,
                  LOG_CONTEXT.HTTP,
                  {
                    correlationId: contextValue.correlationId,
                    path: fieldPath,
                    duration: fieldDuration,
                    error: error.message,
                    args: sanitizeArgs(args),
                  },
                );
              } else {
                // Solo loggear en verbose para no saturar los logs
                logger.verbose(
                  `Resolver: ${info.parentType.name}.${info.fieldName}`,
                  LOG_CONTEXT.HTTP,
                  {
                    correlationId: contextValue.correlationId,
                    path: fieldPath,
                    duration: fieldDuration,
                  },
                );
              }
            };
          },
        };
      },

      //4 - se ejecuta si encunetra errores inesperados
      async didEncounterErrors() {
        const duration = Date.now() - startTime;
        const data = requestContext.response.body;
        const errors = requestContext.errors;


        const hasErrors = errors && errors.length > 0;

        if (hasErrors) {
          logger.error(
            'GraphQL request completed with errors',
            undefined,
            LOG_CONTEXT.HTTP,
            {
              correlationId,
              operationName,
              duration,
              errors: errors.map((e: GraphQLError) => ({
                message: e.message,
                path: e.path,
                extensions: e.extensions,
              })),
            },
          );
        } else {
          logger.log('GraphQL request completed successfully', LOG_CONTEXT.HTTP, {
            correlationId,
            operationName,
            duration,
            dataSize: JSON.stringify(data || {}).length,
          });
        }
      },

      //5 - se ejecuta cuando la request termina (con exito o error)
      async willSendResponse() { },

      // 6- se ejeucta si la operacion fue resuelta - buscamos loggear errores, asi que no usaremos esta función.
      // async didResolveOperation() { },

    }
  }
  // Métodos auxiliares de sanitización
  private sanitizeQuery(query?: string): string {
    if (!query) return 'N/A';
    // Limitar longitud y remover saltos de línea múltiples
    return query
      .replace(/\s+/g, ' ')
      .substring(0, 500)
      .trim();
  }

  private sanitizeArgs(args: Record<string, any>): Record<string, any> {
    const sanitized = { ...args };

    // Remover campos sensibles
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    // Si hay un objeto input, sanitizar recursivamente
    if (sanitized.input && typeof sanitized.input === 'object') {
      sanitized.input = this.sanitizeArgs(sanitized.input);
    }

    return sanitized;
  }

  private formatPath(path: any): string {
    const pathArray: string[] = [];
    let current = path;

    while (current) {
      pathArray.unshift(current.key);
      current = current.prev;
    }

    return pathArray.join('.');
  }

}
