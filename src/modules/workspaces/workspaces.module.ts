import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/user.module.js';
import { Issue, IssueSchema } from '../issues/schemas/issue.schema.js';
import { Project, ProjectSchema } from '../projects/schemas/project.schema.js';
import { AccessService } from './access.service.js';
import { InvitesController } from './invites.controller.js';
import { InvitesService } from './invites.service.js';
import { Invite, InviteSchema } from './schemas/invite.schema.js';
import { WorkspaceMember, WorkspaceMemberSchema } from './schemas/workspace-member.schema.js';
import { Workspace, WorkspaceSchema } from './schemas/workspace.schema.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: WorkspaceMember.name, schema: WorkspaceMemberSchema },
      { name: Invite.name, schema: InviteSchema },
      // needed by AccessService (find a project's/issue's workspace) and by workspace deletion (2.8)
      { name: Project.name, schema: ProjectSchema },
      { name: Issue.name, schema: IssueSchema },
    ]),
    UsersModule,
  ],
  controllers: [WorkspacesController, InvitesController],
  providers: [WorkspacesService, InvitesService, AccessService],
  exports: [WorkspacesService, InvitesService, AccessService],
})
export class WorkspacesModule {}
