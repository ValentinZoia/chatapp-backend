import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { GraphQLExceptionFilter } from './common/filters/graphql-exception.filter';
import { ConfigService } from '@nestjs/config';
import { ILogger } from './common/interfaces/logger.interface';
import { LOGGER_SERVICE } from './common/constants/logger.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  //Logger personalizado - usando winston
  const logger = app.get<ILogger>(LOGGER_SERVICE);
  app.useLogger(logger);

  //CORS
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,//habilitar uso de cookies
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'x-apollo-operation-name',
      'apollo-require-preflight', //!important
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  //Cookie Parser
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(cookieParser());
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 1 }));



  //configuracion de validacion global inicial para manejar dto con class validator
  app.useGlobalPipes(
    new ValidationPipe({
      transformOptions: { enableImplicitConversion: true },
      whitelist: true, //remueve todo lo que no esta en los DTOs
      forbidNonWhitelisted: true, //retorna bad request si hay propiedades no requeridas
      transform: true, //transforma los tipos de datos de la request a los de la entidad
      exceptionFactory: (errors) => {
        const formatedErrors = errors.reduce((accumulador, error) => {
          accumulador[error.property] = Object.values(
            error.constraints as { [s: string]: unknown } | ArrayLike<unknown>,
          ).join(', ');
          return accumulador;
        }, {});

        throw new BadRequestException({
          message: 'Validation failed',
          errors: formatedErrors,
        });
      },
    }),
  );

  //Establecer exceptions-filters globales
  app.useGlobalFilters(new GraphQLExceptionFilter(logger));

  // Obtener configuración
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  await app.listen(port);

  logger.log(
    `Application is running in ${nodeEnv} mode on: http://localhost:${port}`,//message
    'Bootstrap', //Context
  );
  logger.log(
    `GraphQL Playground available at: http://localhost:${port}/graphql`,
    'Bootstrap',
  );

  // console.log(`Application is running in ${nodeEnv} mode on: http://localhost:${port}`);
  // console.log(`GraphQL Playground available at: http://localhost:${port}/graphql`)
}
void bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});;
