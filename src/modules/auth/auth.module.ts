import { Module } from '@nestjs/common';
import { UsersModule } from '../users/user.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { JwtModule } from '@nestjs/jwt';
import { TokensService } from './tokens.service.js';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../../common/gaurds/jwt-auth.gaurd.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';


@Module({
  imports: [UsersModule,JwtModule.register({}),WorkspacesModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokensService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  
})
export class AuthModule {}
