import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { authCookieClearOptions, authCookieOptions, AUTH_COOKIE_NAME } from './auth.constants';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './login.dto';
import { Public } from './auth.decorators';
import { AuthPrincipal } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body);
    response.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions());
    return { user: result.user };
  }

  @Get('me')
  getIdentity(@CurrentUser() user: AuthPrincipal) {
    return { user };
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, authCookieClearOptions());
    return { message: 'Logged out.' };
  }
}
