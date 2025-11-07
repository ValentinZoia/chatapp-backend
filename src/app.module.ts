import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaService } from './common/prisma/prisma.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { TokenService } from './common/token/token.service';
import { ChatroomModule } from './modules/chatroom/chatroom.module';
import { LiveChatroomModule } from './modules/live-chatroom/live-chatroom.module';
import { PubSubModule } from './modules/PubSub/pubsub.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLThrottlerGuard } from './common/throttler/graphql-throttler.guard';
import { GraphQLContext } from './common/interfaces/graphql-context.interface';
import { LoggerModule } from './common/logger/logger.module';
import { CorrelationIdMiddleware } from './common/middleware/correlationId.middleware';
import { LogginPlugin } from './common/plugins/logging.plugin';
import { Request, Response } from 'express';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // carpeta pública
      serveRoot: '/', // opcional: si querés que sea accesible desde la raíz
    }),
    // GraphQLModule.forRoot<ApolloDriverConfig>({
    //   driver: ApolloDriver,
    //   autoSchemaFile: join(process.cwd(), 'src/schema.gql'), //code first
    //   playground: false, //para usar apollo sandbox
    //   plugins: [ApolloServerPluginLandingPageLocalDefault()], // activar el nuevo landing page
    // }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (
        configService: ConfigService,
        tokenService: TokenService,
      ) => ({
        //generar el schema.gql automaticamente - code first
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        playground: false, //no usar el playground default- sino el de apollo sandbox
        plugins: [ApolloServerPluginLandingPageLocalDefault()],
        sortSchema: true,
        subscriptions: {
          'graphql-ws': {
            path: '/graphql',
            onConnect: (connectionParams: any) => {
              console.log('WebSocket client connected');
            },
            onDisconnect: (context: any) => {
              console.log('WebSocket client disconnected');
            },
          },
          //habilitar uso de web-sockets
          'subscriptions-transport-ws': true, //desprecated
        },
        onConnect: async (connectionParams) => {
          const token = tokenService.extractToken(connectionParams);
          if (!token) {
            throw new Error('Token not found');
          }
          const user = tokenService.validateToken(token);
          if (!user) throw new Error('User not found');

          return { user };
        },
        // debug: false,
        introspection: process.env.NODE_ENV !== 'production', //en production -> false
        includeStacktraceInErrorResponses:
          process.env.NODE_ENV === 'development',
        //El context son los datos que van a estar disponibles en todos los resolvers.
        context: ({
          req,
          res,
          connection,
        }: {
          req: Request;
          res: Response;
          connection: any;
        }): GraphQLContext => {
          // Para subscriptions, el context viene de connection
          if (connection) {
            return {
              req,
              res,
              correlationId:
                connection.context.correlationId || 'ws-connection',
            };
          }
          //En esta instancia req existe. si fuer para subscriptions, ya se metio en el condicional de arriba.
          // const userId =
          //   !!req.user &&
          //   typeof req.user !== 'undefined' &&
          //   typeof req.user.sub !== 'undefined'
          //     ? req.user.sub.toString()
          //     : undefined;

          // Para queries/mutations, viene de req

          return {
            req,
            res,
            correlationId: req?.correlationId || 'no-correlation-id',
            userId: (req?.headers['x-user-id'] as string) || undefined,
            startTime: Date.now(),
          };
        },
        formatError: (error) => {
          // Crear respuesta limpia sin locations, path, stacktrace
          const formattedError: any = {
            message: error.message,
            extensions: {
              code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
              timestamp: new Date().toISOString(),
            },
          };

          // Si hay errores de validación, incluirlos
          if (error.extensions?.errors) {
            formattedError.extensions.errors = error.extensions.errors;
          }

          return formattedError;
        },
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    PubSubModule,
    AuthModule,
    UserModule,
    ChatroomModule,
    LiveChatroomModule,
    LoggerModule,
    //Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'long',
            ttl: seconds(60),
            limit: 100,
          },
        ],
        // Storage de Redis
        storage: new ThrottlerStorageRedisService({
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),

          // Opciones adicionales
          keyPrefix: 'throttler:', // Prefijo para keys

          // TLS para producción
          ...(configService.get('REDIS_TLS') === 'true' && {
            tls: {},
          }),
        }),
      }),
    }),
  ],

  providers: [
    PrismaService,
    TokenService,
    LogginPlugin,
    {
      //   //Acá estamos aplicando la guard de Throttler globalmente. sino no va a poder ser usada
      provide: APP_GUARD,
      useClass: GraphQLThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    //Aplicar el middleware a todas las rutas
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
