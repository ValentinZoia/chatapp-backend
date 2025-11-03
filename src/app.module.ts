import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { TokenService } from './token/token.service';
import { ChatroomModule } from './chatroom/chatroom.module';
import { LiveChatroomModule } from './live-chatroom/live-chatroom.module';
import { PubSubModule } from './PubSub/pubsub.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLThrottlerGuard } from './common/throttler/graphql-throttler.guard';


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
        playground: false,
        plugins: [ApolloServerPluginLandingPageLocalDefault()],
        sortSchema: true,
        subscriptions: {
          'graphql-ws': true,
          'subscriptions-transport-ws': true, //desprecated

        },
        onConnect: async (connectionParams) => {
          console.log('WebSocket client connected', {
            correlationId: connectionParams?.correlationId,
            userId: connectionParams?.userId,
          });
          const token = tokenService.extractToken(connectionParams);
          if (!token) {
            throw new Error('Token not found');
          }
          const user = tokenService.validateToken(token);
          if (!user) throw new Error('User not found');

          return { user };
        },
        onDisconnect: (context: any) => {
          console.log('WebSocket client disconnected');
        },
        debug: false,
        introspection: true, //en production -> false
        includeStacktraceInErrorResponses: false,
        context: ({ req, res }) => ({ req, res }),
        formatError: (error) => {
          // Crear respuesta limpia sin locations, path, stacktrace
          const formattedError: any = {
            message: error.message,
            extensions: {
              code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
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
    }),
    PubSubModule,
    AuthModule,
    UserModule,
    ChatroomModule,
    LiveChatroomModule,
    //Rate limiting
    ThrottlerModule.forRoot([{
      name: "short",
      ttl: seconds(1),
      limit: 3,// 3 request cada 1 segundo
    }, {
      name: "long",
      ttl: seconds(60),
      limit: 100,// 100 request cada 1 minuto
    }])
  ],

  providers: [PrismaService, TokenService, {
    //Acá estamos aplicando la guard globalmente
    provide: APP_GUARD,
    useClass: GraphQLThrottlerGuard,
  }],
})
export class AppModule { }
