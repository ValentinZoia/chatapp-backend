import { Module } from '@nestjs/common';
import { AuthResolver } from './resolvers/auth.resolver';
import { AuthService } from './services/auth.service';

@Module({
  providers: [AuthResolver, AuthService]
})
export class AuthModule {}
