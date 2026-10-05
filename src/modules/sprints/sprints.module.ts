import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Issue, IssueSchema } from '../issues/schemas/issue.schema.js';
import { Project, ProjectSchema } from '../projects/schemas/project.schema.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { ActivityModule } from '../activity/activity.module.js';
import { Sprint, SprintSchema } from './schemas/sprint.schema.js';
import { SprintsController } from './sprints.controller.js';
import { SprintsService } from './sprints.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sprint.name, schema: SprintSchema },
      { name: Issue.name, schema: IssueSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    WorkspacesModule, // ProjectMemberGuard needs AccessService
    ActivityModule, // completing a sprint records history for the moved issues
  ],
  controllers: [SprintsController],
  providers: [SprintsService],
})
export class SprintsModule {}
