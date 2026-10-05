import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Issue, IssueSchema } from '../issues/schemas/issue.schema.js';
import { Project, ProjectSchema } from '../projects/schemas/project.schema.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Issue.name, schema: IssueSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    WorkspacesModule, // WorkspaceRoleGuard needs AccessService
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
