import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Issue, IssueSchema } from '../issues/schemas/issue.schema.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { Comment, CommentSchema } from './schemas/comment.schema.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: Issue.name, schema: IssueSchema },
    ]),
    WorkspacesModule, // ProjectMemberGuard needs AccessService
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
