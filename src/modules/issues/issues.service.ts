import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { ISSUE_STATUSES, Issue, IssueDocument } from './schemas/issue.schema.js';
import type { IssueStatus, IssueType } from './schemas/issue.schema.js';
import { ISSUE_REFS } from './issue-refs.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { ListIssuesQueryDto } from './dto/list-issues-query.dto.js';
import { MoveIssueDto } from './dto/move-issue.dto.js';
import { RankIssueDto } from './dto/rank-issue.dto.js';
import { ProjectsService } from '../projects/projects.service.js';
import { AccessService } from '../workspaces/access.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { LabelsService } from '../labels/labels.service.js';
import { Comment, CommentDocument } from '../comments/schemas/comment.schema.js';
import { Activity, ActivityDocument } from '../activity/schemas/activity.schema.js';
import { ActivityService } from '../activity/activity.service.js';
import { diffIssue } from '../activity/diff-issue.js';
import type { IssueSnapshot } from '../activity/diff-issue.js';
import { Sprint, SprintDocument } from '../sprints/schemas/sprint.schema.js';

/** ?assignee=me | none | <userId>  ->  the value to filter assigneeId on */
function assigneeFilter(value: string, userId: string) {
  if (value === 'me') return new Types.ObjectId(userId);
  if (value === 'none') return null;
  return new Types.ObjectId(value);
}

const snapshot = (doc: unknown) => doc as IssueSnapshot;

@Injectable()
export class IssuesService implements OnModuleInit {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    @InjectModel(Issue.name) private issueModel: Model<IssueDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(Sprint.name) private sprintModel: Model<SprintDocument>,
    private projectsService: ProjectsService,
    private access: AccessService,
    private workspaces: WorkspacesService,
    private labels: LabelsService,
    private activity: ActivityService,
  ) {}

  /** One-time backfill: issues created before 3.1 get a rank (kept in `number` order). */
  async onModuleInit() {
    const missing = await this.issueModel
      .find({ order: { $exists: false } })
      .select('projectId number')
      .sort({ number: 1 })
      .lean()
      .exec();
    if (missing.length === 0) return;

    const groups = new Map<string, typeof missing>();
    for (const issue of missing) {
      const groupKey = String(issue.projectId);
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), issue]);
    }

    const updates: { _id: Types.ObjectId; order: string }[] = [];
    for (const list of groups.values()) {
      const keys = generateNKeysBetween(await this.lastOrder(list[0].projectId), null, list.length);
      list.forEach((issue, i) => updates.push({ _id: issue._id, order: keys[i] }));
    }

    await this.issueModel.bulkWrite(
      updates.map((u) => ({ updateOne: { filter: { _id: u._id }, update: { $set: { order: u.order } } } })),
    );
    this.logger.log(`Backfilled rank on ${updates.length} issues`);
  }

  // ---------- helpers ----------

  /** The highest rank in the project. A key after it puts an issue at the very end of every list it appears in. */
  private async lastOrder(projectId: Types.ObjectId): Promise<string | null> {
    const last = await this.issueModel
      .findOne({ projectId, order: { $exists: true } })
      .sort({ order: -1 })
      .select('order')
      .lean()
      .exec();
    return last?.order ?? null;
  }

  private async endOfProject(projectId: Types.ObjectId) {
    return generateKeyBetween(await this.lastOrder(projectId), null);
  }

  /**
   * References must make sense HERE, not just look like ids:
   * - the assignee is a non-viewer member of the project's workspace (viewers are read-only),
   * - every label belongs to this project,
   * - the sprint belongs to this project and isn't completed.
   */
  private async checkRefs(
    projectId: Types.ObjectId,
    dto: { assigneeId?: string | null; labelIds?: string[]; sprintId?: string | null },
  ) {
    if (dto.assigneeId) {
      const workspaceId = await this.access.workspaceIdOfProject(String(projectId));
      const member = await this.workspaces.getMembership(workspaceId, dto.assigneeId);
      if (!member) throw new BadRequestException('The assignee must be a member of this workspace');
      if (member.role === 'viewer') throw new BadRequestException('Viewers cannot be assigned issues');
    }
    if (dto.labelIds?.length) await this.labels.assertInProject(projectId, dto.labelIds);
    if (dto.sprintId) {
      const sprint = await this.sprintModel.findOne({ _id: dto.sprintId, projectId }).select('status').lean().exec();
      if (!sprint) throw new BadRequestException('The sprint does not belong to this project');
      if (sprint.status === 'completed') throw new BadRequestException('Issues cannot be added to a completed sprint');
    }
  }

  /**
   * The rank of a neighbour, checked to be in the same LIST as the drop target:
   * the same status column (board) or the same sprint / backlog (backlog page).
   */
  private async neighbourOrder(
    neighbourId: string | undefined,
    list: QueryFilter<IssueDocument>,
    movingId: string,
  ): Promise<string | null> {
    if (!neighbourId) return null;
    if (neighbourId === movingId) throw new BadRequestException('An issue cannot be its own neighbour');
    const neighbour = await this.issueModel
      .findOne({ _id: neighbourId, ...list })
      .select('order')
      .lean()
      .exec();
    if (!neighbour?.order) throw new BadRequestException('Neighbour issue is not in the target list');
    return neighbour.order;
  }

  /**
   * The hierarchy rules. They keep the tree at depth 2 and make cycles impossible:
   *   epic                 -> no parent
   *   task / story / bug   -> optional parent, and it must be an EPIC
   *   subtask              -> REQUIRED parent, a task / story / bug (never an epic or another subtask)
   * "Validation across documents": the rule depends on ANOTHER issue's type, so a DTO decorator can't check it.
   */
  private async checkHierarchy(projectId: Types.ObjectId, type: IssueType, parentId: string | null, selfId?: string) {
    if (type === 'epic') {
      if (parentId) throw new BadRequestException('An epic cannot have a parent');
      return;
    }
    if (type === 'subtask' && !parentId) throw new BadRequestException('A sub-task needs a parent issue');
    if (!parentId) return;
    if (parentId === selfId) throw new BadRequestException('An issue cannot be its own parent');

    const parent = await this.issueModel.findOne({ _id: parentId, projectId }).select('type').lean().exec();
    if (!parent) throw new BadRequestException('The parent issue must be in the same project');
    if (type === 'subtask' && (parent.type === 'epic' || parent.type === 'subtask')) {
      throw new BadRequestException("A sub-task's parent must be a task, story or bug");
    }
    if (type !== 'subtask' && parent.type !== 'epic') {
      throw new BadRequestException('Only an epic can be the parent of a task, story or bug');
    }
  }

  /** A key between the two neighbours; if they collide (two drops into the same gap at once), the end instead. */
  private async rankBetween(projectId: Types.ObjectId, before: string | null, after: string | null) {
    try {
      return generateKeyBetween(before, after);
    } catch {
      return this.endOfProject(projectId);
    }
  }

  // ---------- writes ----------

  /** Validate references BEFORE reserving a number, so a rejected request doesn't burn an issue key. */
  async create(projectId: string, dto: CreateIssueDto, reporterId: string) {
    const pid = new Types.ObjectId(projectId);
    await this.checkRefs(pid, dto);
    await this.checkHierarchy(pid, dto.type ?? 'task', dto.parentId ?? null);

    // a sub-task gets its own key from the same counter (PROJ-43), like any issue
    const { projectKey, number } = await this.projectsService.reserveIssueNumber(projectId);
    const issue = await this.issueModel.create({
      ...dto,
      projectId: pid,
      reporterId: new Types.ObjectId(reporterId),
      number,
      key: `${projectKey}-${number}`,
      order: await this.endOfProject(pid),
    });
    await this.activity.record(issue, reporterId, 'created');
    return issue.populate(ISSUE_REFS);
  }

  /**
   * A status change from anywhere except the board puts the card at the bottom of its new column.
   * The "before" copy is loaded POPULATED so the activity diff can store names, not ids.
   */
  async update(id: string, dto: UpdateIssueDto, actorId: string) {
    const before = await this.issueModel.findById(id).populate(ISSUE_REFS).lean().exec();
    if (!before) throw new NotFoundException(`Issue ${id} not found`);
    await this.checkRefs(before.projectId, dto);

    if (dto.type !== undefined || dto.parentId !== undefined) {
      const type = dto.type ?? before.type;
      // the rules apply to the issue AFTER the change: new values where sent, current values otherwise
      const currentParent = (before.parentId as unknown as { _id: Types.ObjectId } | null)?._id;
      const parentId = dto.parentId !== undefined ? dto.parentId : currentParent ? String(currentParent) : null;
      await this.checkHierarchy(before.projectId, type, parentId, id);
      // its children's rules depend on its type (an epic's children are tasks, a task's are sub-tasks)
      if (type !== before.type && (await this.issueModel.exists({ parentId: before._id }))) {
        throw new BadRequestException("This issue has child issues, so its type can't change");
      }
    }

    const changes: UpdateIssueDto & { order?: string } = { ...dto };
    if (dto.status && dto.status !== before.status) changes.order = await this.endOfProject(before.projectId);

    const issue = await this.issueModel.findByIdAndUpdate(id, changes, { new: true }).populate(ISSUE_REFS).exec();
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);

    await this.activity.record(issue, actorId, 'updated', diffIssue(snapshot(before), snapshot(issue.toObject())));
    return issue;
  }

  /** Board drag & drop: new status column + position between two cards of that column. One document updated. */
  async move(id: string, dto: MoveIssueDto, actorId: string): Promise<IssueDocument> {
    // raw document on purpose: we call .save(), so it must NOT be populated
    const issue = await this.issueModel.findById(id).exec();
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);

    const column = { projectId: issue.projectId, status: dto.status };
    const [before, after] = await Promise.all([
      this.neighbourOrder(dto.beforeId, column, id),
      this.neighbourOrder(dto.afterId, column, id),
    ]);

    const fromStatus = issue.status;
    issue.status = dto.status;
    issue.order = await this.rankBetween(issue.projectId, before, after);
    await issue.save();
    // reordering inside a column is not history-worthy; changing column is
    if (fromStatus !== dto.status) {
      await this.activity.record(issue, actorId, 'updated', [{ field: 'status', from: fromStatus, to: dto.status }]);
    }
    return issue;
  }

  /**
   * Backlog drag & drop: into a sprint (or the backlog, sprintId null) + position between two issues of that list.
   * Same idea as move(), different list.
   */
  async rank(id: string, dto: RankIssueDto, actorId: string) {
    const issue = await this.issueModel.findById(id).populate({ path: 'sprintId', select: 'name' }).exec();
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    await this.checkRefs(issue.projectId, { sprintId: dto.sprintId });

    const targetSprint = dto.sprintId ? new Types.ObjectId(dto.sprintId) : null;
    const list = { projectId: issue.projectId, sprintId: targetSprint };
    const [before, after] = await Promise.all([
      this.neighbourOrder(dto.beforeId, list, id),
      this.neighbourOrder(dto.afterId, list, id),
    ]);
    const order = await this.rankBetween(issue.projectId, before, after);

    const from = issue.sprintId as unknown as { _id: Types.ObjectId; name: string } | null;
    await this.issueModel.updateOne({ _id: issue._id }, { $set: { sprintId: targetSprint, order } }).exec();

    if (String(from?._id ?? null) !== String(targetSprint)) {
      const to = targetSprint ? await this.sprintModel.findById(targetSprint).select('name').lean().exec() : null;
      await this.activity.record(issue, actorId, 'updated', [
        { field: 'sprint', from: from?.name ?? null, to: to?.name ?? null },
      ]);
    }
    return { id, sprintId: targetSprint, order };
  }

  /**
   * Sub-tasks can't exist without their parent, so they're deleted with it (with their comments and history).
   * An epic's children are real work on their own: they're only unlinked.
   */
  async remove(id: string): Promise<void> {
    const result = await this.issueModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Issue ${id} not found`);

    const subtaskIds = await this.issueModel.find({ parentId: result._id, type: 'subtask' }).distinct('_id').exec();
    await this.issueModel.deleteMany({ _id: { $in: subtaskIds } }).exec();
    await this.issueModel.updateMany({ parentId: result._id }, { $set: { parentId: null } }).exec();

    const gone = [result._id, ...subtaskIds];
    await this.commentModel.deleteMany({ issueId: { $in: gone } }).exec();
    await this.activityModel.deleteMany({ issueId: { $in: gone } }).exec();
  }

  // ---------- reads ----------

  async findAllByProject(projectId: string, query: ListIssuesQueryDto, userId: string) {
    await this.projectsService.findOne(projectId);

    const filter: QueryFilter<IssueDocument> = { projectId: new Types.ObjectId(projectId) };
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.priority) filter.priority = query.priority;
    if (query.assignee) filter.assigneeId = assigneeFilter(query.assignee, userId);
    if (query.label) filter.labelIds = new Types.ObjectId(query.label);
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escaped, $options: 'i' };
    }

    const sort = query.sort ?? '-number';
    const sortSpec: Record<string, 1 | -1> = {
      [sort.replace('-', '')]: sort.startsWith('-') ? -1 : 1,
    };

    const [items, total] = await Promise.all([
      this.issueModel
        .find(filter)
        .sort(sortSpec)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate(ISSUE_REFS)
        .exec(),
      this.issueModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  /**
   * With an active sprint, the board shows only that sprint's issues (Scrum).
   * Without one, it shows every issue of the project (Kanban), so projects that don't use sprints still work.
   */
  async getBoard(projectId: string, userId: string, assignee?: string) {
    const pid = new Types.ObjectId(projectId);
    const filter: QueryFilter<IssueDocument> = { projectId: pid };
    const active = await this.sprintModel.findOne({ projectId: pid, status: 'active' }).select('_id').lean().exec();
    if (active) filter.sprintId = active._id;
    if (assignee) filter.assigneeId = assigneeFilter(assignee, userId);

    const issues = await this.issueModel
      .find(filter)
      .select('key number title type status priority order assigneeId labelIds storyPoints dueDate parentId')
      .sort({ order: 1, number: 1 })
      .populate(ISSUE_REFS)
      .lean()
      .exec();

    const board = Object.fromEntries(ISSUE_STATUSES.map((s) => [s, [] as typeof issues])) as Record<
      IssueStatus,
      typeof issues
    >;
    for (const issue of issues) board[issue.status].push(issue);
    return board;
  }

  /**
   * The children of an issue (an epic's tasks, or a task's sub-tasks) and their progress.
   * Progress is an AGGREGATION: Mongo counts and sums in the database ($group) instead of
   * shipping every child to Node just to count them.
   */
  async children(id: string) {
    const parentId = new Types.ObjectId(id);
    const [items, [progress]] = await Promise.all([
      this.issueModel
        .find({ parentId })
        .select('key number title type status priority order assigneeId labelIds storyPoints dueDate')
        .sort({ order: 1 })
        .populate(ISSUE_REFS.filter((r) => r.path !== 'parentId'))
        .lean()
        .exec(),
      this.issueModel.aggregate<{ total: number; done: number; points: number; donePoints: number }>([
        { $match: { parentId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
            points: { $sum: { $ifNull: ['$storyPoints', 0] } },
            donePoints: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, { $ifNull: ['$storyPoints', 0] }, 0] } },
          },
        },
        { $project: { _id: 0 } },
      ]),
    ]);
    return { items, progress: progress ?? { total: 0, done: 0, points: 0, donePoints: 0 } };
  }

  /**
   * Every epic of the project with its progress, in ONE query: $lookup joins each epic to its children
   * (a left outer join inside the database), then $size / $filter count them.
   * Used by the "parent epic" picker.
   */
  epics(projectId: string) {
    return this.issueModel.aggregate([
      { $match: { projectId: new Types.ObjectId(projectId), type: 'epic' } },
      { $sort: { number: 1 } },
      {
        $lookup: {
          from: this.issueModel.collection.name,
          localField: '_id',
          foreignField: 'parentId',
          pipeline: [{ $project: { status: 1 } }],
          as: 'children',
        },
      },
      {
        $project: {
          key: 1,
          title: 1,
          status: 1,
          total: { $size: '$children' },
          done: { $size: { $filter: { input: '$children', cond: { $eq: ['$$this.status', 'done'] } } } },
        },
      },
    ]);
  }

  async findOne(id: string) {
    const issue = await this.issueModel.findById(id).populate(ISSUE_REFS).exec();
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    return issue;
  }

  async findByKey(projectId: string, key: string) {
    const issue = await this.issueModel
      .findOne({ projectId: new Types.ObjectId(projectId), key: key.toUpperCase() })
      .populate(ISSUE_REFS)
      .exec();
    if (!issue) throw new NotFoundException(`Issue ${key} not found`);
    return issue;
  }
}
