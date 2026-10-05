import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import{MongooseModule} from '@nestjs/mongoose';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { IssuesModule } from './modules/issues/issues.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { UsersModule } from './modules/users/user.module.js';
import { MailModule } from './infra/mail/mail.module.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { SprintsModule } from './modules/sprints/sprints.module.js';
import { SearchModule } from './modules/search/search.module.js';


@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ConfigModule.forRoot({
      isGlobal: true,
      validate :validateEnv,
    }),
     MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
    }),
     ProjectsModule,
     IssuesModule,
     RedisModule,
     UsersModule,
     MailModule,
     AuthModule,
     ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
     WorkspacesModule,
     CommentsModule,
     SprintsModule,
     SearchModule,
  ],
  controllers: [AppController],
  providers: [AppService,
      {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
          { provide: APP_GUARD, useClass: ThrottlerGuard },

  ],
})
export class AppModule {}
