import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Issue, IssueSchema } from '../issues/schemas/issue.schema.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { Label, LabelSchema } from './schemas/label.schema.js';
import { LabelsController } from './labels.controller.js';
import { LabelsService } from './labels.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Label.name, schema: LabelSchema },
      { name: Issue.name, schema: IssueSchema },
    ]),
    WorkspacesModule,
  ],
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService],
})
export class LabelsModule {}
