import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';
import { Issue, IssueSchema } from './schemas/issue.schema.js';
import { ProjectsModule } from '../projects/projects.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Issue.name, schema: IssueSchema }]),
    ProjectsModule,
  ],
  controllers: [IssuesController],
  providers: [IssuesService],
})
export class IssuesModule {}
