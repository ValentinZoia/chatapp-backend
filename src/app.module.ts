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
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        playground: false,
        plugins: [ApolloServerPluginLandingPageLocalDefault()],
        sortSchema: true,
        subscriptions: {
          'graphql-ws': true,
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
  ],

  providers: [PrismaService, TokenService],
})
export class AppModule {}
