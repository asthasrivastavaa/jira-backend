import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Connection } from 'mongoose'; // type-only export: a plain import crashes at runtime under ESM
import { Issue, IssueDocument } from '../issues/schemas/issue.schema.js';
import { Project, ProjectDocument } from '../projects/schemas/project.schema.js';
import { ActivityService } from '../activity/activity.service.js';
import { ISSUE_REFS } from '../issues/issue-refs.js';
import { Sprint, SprintDocument } from './schemas/sprint.schema.js';
import type { SprintStatus } from './schemas/sprint.schema.js';
import { CompleteSprintDto, CreateSprintDto, StartSprintDto, UpdateSprintDto } from './dto/sprint.dto.js';

const OPEN: { $in: SprintStatus[] } = { $in: ['planned', 'active'] };
const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

@Injectable()
export class SprintsService {
  constructor(
    @InjectModel(Sprint.name) private sprintModel: Model<SprintDocument>,
    @InjectModel(Issue.name) private issueModel: Model<IssueDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    // the raw connection: transactions are started on it (connection.startSession())
    @InjectConnection() private connection: Connection,
    private activity: ActivityService,
  ) {}

  /** Open sprints (active first, then planned in creation order). */
  list(projectId: string) {
    return this.sprintModel
      .find({ projectId: new Types.ObjectId(projectId), status: OPEN })
      .sort({ status: 1, createdAt: 1 }) // 'active' < 'planned' alphabetically
      .lean()
      .exec();
  }

  /**
   * The backlog page in one request: every open sprint with its issues, then the backlog
   * (issues in no sprint that aren't done). Everything sorted by the project-wide rank.
   */
  async backlog(projectId: string) {
    const pid = new Types.ObjectId(projectId);
    const sprints = await this.list(projectId);
    const issues = await this.issueModel
      .find({
        projectId: pid,
        $or: [{ sprintId: { $in: sprints.map((s) => s._id) } }, { sprintId: null, status: { $ne: 'done' } }],
      })
      .select('key number title type status priority order assigneeId labelIds storyPoints dueDate sprintId parentId')
      .sort({ order: 1 })
      .populate(ISSUE_REFS.filter((r) => r.path !== 'sprintId')) // we group by the raw sprintId below
      .lean()
      .exec();

    const bySprint = new Map<string, typeof issues>(sprints.map((s) => [String(s._id), []]));
    const backlog: typeof issues = [];
    for (const issue of issues) {
      if (issue.sprintId) bySprint.get(String(issue.sprintId))?.push(issue);
      else backlog.push(issue);
    }
    return { sprints: sprints.map((s) => ({ ...s, issues: bySprint.get(String(s._id)) ?? [] })), backlog };
  }

  async create(projectId: string, dto: CreateSprintDto) {
    const pid = new Types.ObjectId(projectId);
    let name = dto.name;
    if (!name) {
      const project = await this.projectModel.findById(pid).select('key').lean().exec();
      const count = await this.sprintModel.countDocuments({ projectId: pid }).exec();
      name = `${project?.key ?? 'Sprint'} Sprint ${count + 1}`;
    }
    return this.sprintModel.create({ projectId: pid, name, goal: dto.goal ?? '' });
  }

  async update(projectId: string, sprintId: string, dto: UpdateSprintDto) {
    const sprint = await this.find(projectId, sprintId);
    if (sprint.status === 'completed') throw new BadRequestException('A completed sprint cannot be edited');
    if (dto.name !== undefined) sprint.name = dto.name;
    if (dto.goal !== undefined) sprint.goal = dto.goal;
    if (dto.startDate !== undefined) sprint.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) sprint.endDate = dto.endDate ? new Date(dto.endDate) : null;
    this.checkDates(sprint.startDate, sprint.endDate);
    return sprint.save();
  }

  /**
   * planned -> active. The "only one active sprint" rule is checked twice:
   * a friendly pre-check for the normal case, and the partial unique index for the race
   * (two starts at the same instant both pass the pre-check; the index rejects the second).
   */
  async start(projectId: string, sprintId: string, dto: StartSprintDto) {
    const sprint = await this.find(projectId, sprintId);
    if (sprint.status !== 'planned') throw new BadRequestException('Only a planned sprint can be started');
    if (await this.sprintModel.exists({ projectId: sprint.projectId, status: 'active' })) {
      throw new ConflictException('This project already has an active sprint. Complete it first.');
    }

    sprint.status = 'active';
    if (dto.name) sprint.name = dto.name;
    if (dto.goal !== undefined) sprint.goal = dto.goal;
    sprint.startDate = new Date(dto.startDate);
    sprint.endDate = new Date(dto.endDate);
    this.checkDates(sprint.startDate, sprint.endDate);
    try {
      return await sprint.save();
    } catch (err) {
      if (isDuplicateKey(err)) throw new ConflictException('This project already has an active sprint. Complete it first.');
      throw err;
    }
  }

  /**
   * active -> completed, in ONE TRANSACTION:
   *   1. unfinished issues move to the backlog or to a planned sprint,
   *   2. their history entries are written,
   *   3. the sprint is closed with a frozen summary.
   * Without the transaction, a crash after step 1 would leave a sprint that's still "active"
   * but already emptied, and nobody could tell which issues used to be in it.
   * session.withTransaction() also RETRIES the whole callback on transient errors (e.g. a write conflict).
   */
  async complete(projectId: string, sprintId: string, dto: CompleteSprintDto, actorId: string) {
    const sprint = await this.find(projectId, sprintId);
    if (sprint.status !== 'active') throw new BadRequestException('Only the active sprint can be completed');

    let target: SprintDocument | null = null;
    if (dto.moveTo !== 'backlog') {
      target = await this.find(projectId, dto.moveTo);
      if (target.status !== 'planned') throw new BadRequestException('Unfinished issues can only move to a planned sprint');
    }

    const session = await this.connection.startSession();
    try {
      let summary = { doneIssues: 0, doneStoryPoints: 0, movedIssues: 0 };
      await session.withTransaction(async () => {
        const issues = await this.issueModel
          .find({ sprintId: sprint._id })
          .select('projectId status storyPoints')
          .session(session)
          .lean()
          .exec();
        const done = issues.filter((i) => i.status === 'done');
        const unfinished = issues.filter((i) => i.status !== 'done');

        await this.issueModel
          .updateMany({ _id: { $in: unfinished.map((i) => i._id) } }, { $set: { sprintId: target?._id ?? null } })
          .session(session)
          .exec();

        await this.activity.recordMany(
          unfinished.map((issue) => ({
            issue,
            changes: [{ field: 'sprint', from: sprint.name, to: target?.name ?? null }],
          })),
          actorId,
          session,
        );

        summary = {
          doneIssues: done.length,
          doneStoryPoints: done.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
          movedIssues: unfinished.length,
        };
        const closed = await this.sprintModel
          .updateOne(
            { _id: sprint._id, status: 'active' }, // guard: someone else may have completed it meanwhile
            { $set: { status: 'completed', completedAt: new Date(), summary } },
          )
          .session(session)
          .exec();
        if (closed.modifiedCount !== 1) throw new ConflictException('This sprint was already completed');
      });
      return { id: sprintId, ...summary };
    } finally {
      await session.endSession();
    }
  }

  /** Only planned sprints can be deleted; their issues go back to the backlog (same transaction). */
  async remove(projectId: string, sprintId: string) {
    const sprint = await this.find(projectId, sprintId);
    if (sprint.status !== 'planned') {
      throw new BadRequestException('Only a planned sprint can be deleted. Complete the active sprint instead.');
    }
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        await this.issueModel.updateMany({ sprintId: sprint._id }, { $set: { sprintId: null } }).session(session).exec();
        await this.sprintModel.deleteOne({ _id: sprint._id }).session(session).exec();
      });
    } finally {
      await session.endSession();
    }
    return { id: sprintId };
  }

  private async find(projectId: string, sprintId: string) {
    const sprint = await this.sprintModel
      .findOne({ _id: sprintId, projectId: new Types.ObjectId(projectId) })
      .exec();
    if (!sprint) throw new NotFoundException('Sprint not found');
    return sprint;
  }

  private checkDates(start: Date | null, end: Date | null) {
    if (start && end && end < start) throw new BadRequestException('The end date must be on or after the start date');
  }
}
