import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResendOtpDto } from './dto/resend-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { clearAuthCookies, setAuthCookies } from './auth-cookies.js';
import { REFRESH_COOKIE } from './auth.constants.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import { Throttle } from '@nestjs/throttler';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { RegisterWithInviteDto } from './dto/register-with-invite.dto.js';
import { ConfirmEmailChangeDto, RequestEmailChangeDto } from './dto/change-email.dto.js';


@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
@Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }


  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  @Public()
  	@Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { verified, tokens } = await this.auth.verifyOtp(dto);
    setAuthCookies(res, tokens);
    return { verified };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendOtp(dto.email);
  }
  @Public()
  	@Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.login(dto);
    setAuthCookies(res, tokens);
    return { user };
  }
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Missing refresh token');
    try {
      setAuthCookies(res, await this.auth.refresh(token));
    } catch (err) {
      clearAuthCookies(res);
      throw err;
    }
    return { refreshed: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    clearAuthCookies(res);
    return { loggedOut: true };
  }

    @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  // ---- change email (logged-in users only: no @Public) ----

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('change-email/request')
  @HttpCode(HttpStatus.OK)
  requestEmailChange(@CurrentUser() user: RequestUser, @Body() dto: RequestEmailChangeDto) {
    return this.auth.requestEmailChange(user.id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('change-email/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmEmailChange(
    @CurrentUser() user: RequestUser,
    @Body() dto: ConfirmEmailChangeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, tokens } = await this.auth.confirmEmailChange(user.id, dto.code);
    setAuthCookies(res, tokens);
    return { email };
  }

  // Invited person with no account yet: the invite link proves the email, so no OTP.
  // Creates a verified account, joins the workspace and logs the user in.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register-with-invite')
  async registerWithInvite(
    @Body() dto: RegisterWithInviteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, workspace, tokens } = await this.auth.registerWithInvite(dto);
    setAuthCookies(res, tokens);
    return { user, workspace };
  }

}
