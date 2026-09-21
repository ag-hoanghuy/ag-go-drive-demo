import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Thiếu access token');
    }

    request.user = await this.authService.verifyAccessToken(token);
    return true;
  }

  private extractBearerToken(authorization?: string): string | undefined {
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || undefined;
  }
}

