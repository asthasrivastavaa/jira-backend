import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { Project, ProjectSchema } from './schemas/project.schema.js';
import { Issue, IssueSchema } from '../issues/schemas/issue.schema.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { Label, LabelSchema } from '../labels/schemas/label.schema.js';
import { Comment, CommentSchema } from '../comments/schemas/comment.schema.js';
import { Activity, ActivitySchema } from '../activity/schemas/activity.schema.js';
import { Sprint, SprintSchema } from '../sprints/schemas/sprint.schema.js';
@Module({
  imports: [ MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Issue.name, schema: IssueSchema },
      { name: Label.name, schema: LabelSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: Sprint.name, schema: SprintSchema },
    ]), WorkspacesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
