import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'), //code first
      playground: false, //para usar apollo sandbox
      plugins: [ApolloServerPluginLandingPageLocalDefault()], // activar el nuevo landing page
    }),
    AuthModule,
  ],

  providers: [PrismaService],
})
export class AppModule {}
