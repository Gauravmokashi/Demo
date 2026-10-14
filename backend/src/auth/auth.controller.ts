import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
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

  // Slides the session forward for an active user. Requires a still-valid session, so an idle
  // user is signed out when the 15-minute token expires.
  @Post('refresh')
  @HttpCode(200)
  refresh(@CurrentUser() user: AuthPrincipal, @Res({ passthrough: true }) response: Response) {
    const result = this.authService.issueSession(user);
    response.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions());
    return { user: result.user };
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, authCookieClearOptions());
    return { message: 'Logged out.' };
  }
}
