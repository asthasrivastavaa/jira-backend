import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { Project, ProjectSchema } from './schemas/project.schema.js';
import { Issue, IssueSchema } from '../issues/schemas/issue.schema.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
@Module({
  imports: [ MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Issue.name, schema: IssueSchema },
    ]), WorkspacesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
