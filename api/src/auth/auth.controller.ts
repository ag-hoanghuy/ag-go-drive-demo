import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(AuthGuard)
  getProfile(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}

