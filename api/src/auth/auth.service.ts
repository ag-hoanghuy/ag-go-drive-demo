import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService {
  private jwks: JWTVerifyGetKey | undefined;
  private jwksIssuer: string | undefined;

  constructor(private readonly configService: ConfigService) {}

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const issuer = this.getIssuer();
    const audience = this.configService.get<string>('AUTH0_AUDIENCE')?.trim();

    if (!audience) {
      throw new UnauthorizedException('Auth0 chưa được cấu hình');
    }

    try {
      const { payload } = await jwtVerify(token, this.getJwks(issuer), {
        algorithms: ['RS256'],
        issuer,
        audience,
      });

      if (!payload.sub) {
        throw new UnauthorizedException('Access token không có subject');
      }

      return {
        sub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : null,
        name: typeof payload.name === 'string' ? payload.name : null,
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Access token không hợp lệ');
    }
  }

  private getIssuer(): string {
    const configuredIssuer = this.configService
      .get<string>('AUTH0_ISSUER_URL')
      ?.trim();

    if (!configuredIssuer) {
      throw new UnauthorizedException('Auth0 chưa được cấu hình');
    }

    try {
      const issuerUrl = new URL(configuredIssuer);
      return issuerUrl.href.endsWith('/')
        ? issuerUrl.href
        : `${issuerUrl.href}/`;
    } catch {
      throw new UnauthorizedException('Auth0 issuer không hợp lệ');
    }
  }

  private getJwks(issuer: string): JWTVerifyGetKey {
    if (!this.jwks || this.jwksIssuer !== issuer) {
      this.jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', issuer));
      this.jwksIssuer = issuer;
    }

    return this.jwks;
  }
}

