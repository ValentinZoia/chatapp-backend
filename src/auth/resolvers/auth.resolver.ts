import { Query, Resolver } from '@nestjs/graphql';
import { AuthService } from '../services/auth.service';

@Resolver()
export class AuthResolver {
  constructor(private readonly aurhService: AuthService) {}

  @Query(() => String, { name: 'hello', description: 'just return hello' })
  hello() {
    return 'hello brah! u mirin? ';
  }
}
