import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Issue, IssueDocument } from '../issues/schemas/issue.schema.js';
import { hasRole } from '../workspaces/roles.js';
import type { WorkspaceMemberDocument } from '../workspaces/schemas/workspace-member.schema.js';
import { Comment, CommentDocument } from './schemas/comment.schema.js';
import { CursorQueryDto } from '../../common/dto/cursor-query.dto.js';
import { isBlankHtml, sanitizeComment } from './sanitize-comment.js';

const AUTHOR = { path: 'authorId', select: 'name email' };

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Issue.name) private issueModel: Model<IssueDocument>,
  ) {}

  /**
   * Newest first, `limit` at a time. We fetch limit + 1: if the extra one exists there is another page,
   * and we learn that without a countDocuments(). The next cursor is the _id of the last comment returned.
   *
   * Why not page=2? With offset paging, a comment added while you read shifts everything by one,
   * so "page 2" repeats a comment. A cursor says "older than THIS one", which new comments can't disturb.
   */
  async list(issueId: string, query: CursorQueryDto) {
    const filter: QueryFilter<CommentDocument> = { issueId: new Types.ObjectId(issueId) };
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };

    const rows = await this.commentModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + 1)
      .populate(AUTHOR)
      .lean()
      .exec();

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return { items, meta: { nextCursor: hasMore ? String(items[items.length - 1]._id) : null } };
  }

  async create(issueId: string, authorId: string, html: string) {
    const issue = await this.issueModel.findById(issueId).select('projectId').lean().exec();
    if (!issue) throw new NotFoundException('Issue not found');

    const comment = await this.commentModel.create({
      issueId: issue._id,
      projectId: issue.projectId,
      authorId: new Types.ObjectId(authorId),
      body: this.clean(html),
    });
    return comment.populate(AUTHOR);
  }

  /** Resource-owner rule: only the author may edit, whatever their role. */
  async update(issueId: string, commentId: string, userId: string, html: string) {
    const comment = await this.find(issueId, commentId);
    if (String(comment.authorId) !== userId) throw new ForbiddenException('Only the author can edit a comment');

    comment.body = this.clean(html);
    comment.editedAt = new Date();
    await comment.save();
    return comment.populate(AUTHOR);
  }

  /** The author may delete their comment; admins and the owner may delete any comment (moderation). */
  async remove(issueId: string, commentId: string, membership: WorkspaceMemberDocument) {
    const comment = await this.find(issueId, commentId);
    const isAuthor = String(comment.authorId) === String(membership.userId);
    if (!isAuthor && !hasRole(membership.role, 'admin')) {
      throw new ForbiddenException('Only the author or an admin can delete a comment');
    }
    await comment.deleteOne();
    // 4.2: also delete the comment's attachments here
    return { id: commentId };
  }

  private async find(issueId: string, commentId: string) {
    // scoped by issueId too: a comment id from another issue is "not found", not editable through this URL
    const comment = await this.commentModel
      .findOne({ _id: commentId, issueId: new Types.ObjectId(issueId) })
      .exec();
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  private clean(html: string) {
    const safe = sanitizeComment(html);
    if (isBlankHtml(safe)) throw new BadRequestException('A comment cannot be empty');
    return safe;
  }
}
