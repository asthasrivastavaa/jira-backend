import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { Activity, ActivitySchema } from './schemas/activity.schema.js';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Activity.name, schema: ActivitySchema }]), WorkspacesModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService], // IssuesService records into it
})
export class ActivityModule {}
