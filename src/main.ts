import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //CORS
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'apollo-require-preflight', //!important
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  //Cookie Parser
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(cookieParser());
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 1 }));

  //configuracion inicial para manejar dto con class validator
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
        throw new BadRequestException(formatedErrors);
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();
