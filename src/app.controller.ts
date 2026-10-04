import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './common/decorators/public.decorator.js';
// import { MailService } from './infra/mail/mail.service.js';
// import { RedisService } from './infra/redis/redis.service.js';

@Controller('health')
export class AppController {
  constructor(
    private readonly appService: AppService,
    // private readonly mail: MailService,
    // private readonly redisService: RedisService,
  ) {}


  @Public()
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
  //   @Get('mail-test')
  // async mailTest() {
  //   await this.mail.sendOtp('test@example.com', '123456', 'verify');
  //   return { sent: true };
  // }

//   @Get('redis-test')
// async redisTest() {
//   await this.redisService.set('test:hello', 'world', 30);
//   return { ttl: await this.redisService.ttl('test:hello') };
// }

}