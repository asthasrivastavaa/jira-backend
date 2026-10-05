import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';
import { Issue, IssueSchema } from './schemas/issue.schema.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { LabelsModule } from '../labels/labels.module.js';
import { Comment, CommentSchema } from '../comments/schemas/comment.schema.js';
import { Activity, ActivitySchema } from '../activity/schemas/activity.schema.js';
import { ActivityModule } from '../activity/activity.module.js';
import { Sprint, SprintSchema } from '../sprints/schemas/sprint.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Issue.name, schema: IssueSchema },
      // deleting an issue deletes its comments and history
      { name: Comment.name, schema: CommentSchema },
      { name: Activity.name, schema: ActivitySchema },
      // the board needs the active sprint; sprintId on issues is validated against it
      { name: Sprint.name, schema: SprintSchema },
    ]),
    ProjectsModule,
    WorkspacesModule, // the route guards need AccessService
    LabelsModule, // IssuesService validates labelIds; also registers the /labels routes
    ActivityModule, // IssuesService records history
  ],
  controllers: [IssuesController],
  providers: [IssuesService],
})
export class IssuesModule {}
