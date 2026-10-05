import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import type { ClientSession } from 'mongoose';
import { CursorQueryDto } from '../../common/dto/cursor-query.dto.js';
import { Activity, ActivityDocument } from './schemas/activity.schema.js';
import type { ActivityType, FieldChange } from './schemas/activity.schema.js';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(@InjectModel(Activity.name) private activityModel: Model<ActivityDocument>) {}

  /**
   * Called by IssuesService AFTER a successful write. An update that changed nothing records nothing.
   * A failure here is logged, not thrown: the user's change already happened, and losing one history
   * line is better than reporting "save failed" for a save that worked.
   */
  async record(
    issue: { _id: Types.ObjectId; projectId: Types.ObjectId },
    actorId: string,
    type: ActivityType,
    changes: FieldChange[] = [],
  ) {
    if (type === 'updated' && changes.length === 0) return;
    try {
      await this.activityModel.create({
        issueId: issue._id,
        projectId: issue.projectId,
        actorId: new Types.ObjectId(actorId),
        type,
        changes,
      });
    } catch (err) {
      this.logger.error(`Could not record activity for issue ${String(issue._id)}`, err as Error);
    }
  }

  /**
   * Bulk version for operations that change many issues at once (completing a sprint).
   * Takes the caller's transaction session, so the history is written in the SAME transaction:
   * either the issues moved and the history says so, or neither happened.
   */
  async recordMany(
    entries: { issue: { _id: Types.ObjectId; projectId: Types.ObjectId }; changes: FieldChange[] }[],
    actorId: string,
    session: ClientSession,
  ) {
    if (entries.length === 0) return;
    const actor = new Types.ObjectId(actorId);
    await this.activityModel.insertMany(
      entries.map((e) => ({
        issueId: e.issue._id,
        projectId: e.issue.projectId,
        actorId: actor,
        type: 'updated' as const,
        changes: e.changes,
      })),
      { session },
    );
  }

  /** Newest first, cursor-paginated (same pattern as comments). */
  async list(issueId: string, query: CursorQueryDto) {
    const filter: QueryFilter<ActivityDocument> = { issueId: new Types.ObjectId(issueId) };
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };

    const rows = await this.activityModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + 1)
      .populate({ path: 'actorId', select: 'name email' })
      .lean()
      .exec();

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return { items, meta: { nextCursor: hasMore ? String(items[items.length - 1]._id) : null } };
  }
}
