import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const ISSUE_TYPES = ['task', 'bug', 'story', 'epic', 'subtask'] as const;
export const ISSUE_STATUSES = ['todo', 'in-progress', 'done'] as const;
export const ISSUE_PRIORITIES = ['low', 'medium', 'high'] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export type IssueDocument = HydratedDocument<Issue>;

@Schema({ timestamps: true })
export class Issue {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ required: true })
  number: number;

  @Prop({ required: true })
  key: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: String, enum: ISSUE_TYPES, default: 'task' })
  type: IssueType;

  @Prop({ type: String, enum: ISSUE_STATUSES, default: 'todo' })
  status: IssueStatus;

  @Prop({ type: String, enum: ISSUE_PRIORITIES, default: 'medium' })
  priority: IssuePriority;

  // Fractional-index key ("a0", "a0V", …): the issue's RANK in the whole project (like Jira's rank).
  // Board columns and backlog lists all sort by it, so moving an issue up in the backlog also moves it
  // up in its board column. New issues get a key after every other one in the project.
  @Prop({ type: String, required: true })
  order: string;

  // ---- sprints (3.5) ----

  /** null = in the backlog */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Sprint', default: null })
  sprintId: Types.ObjectId | null;

  // ---- hierarchy (3.6): a tree of depth 2 ----
  // epic  ->  task / story / bug  ->  subtask
  // A subtask REQUIRES a parent (task/story/bug); task/story/bug MAY have an epic parent; an epic has none.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Issue', default: null, index: true })
  parentId: Types.ObjectId | null;

  // ---- people, labels, estimate, deadline (3.2) ----

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  assigneeId: Types.ObjectId | null;

  // set by the server from the logged-in user, never from the request body
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  reporterId: Types.ObjectId | null;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Label' }], default: [] })
  labelIds: Types.ObjectId[];

  @Prop({ type: Number, min: 0, max: 100, default: null })
  storyPoints: number | null;

  // a calendar day stored as UTC midnight ("2026-10-10" -> 2026-10-10T00:00:00Z)
  @Prop({ type: Date, default: null })
  dueDate: Date | null;
}

export const IssueSchema = SchemaFactory.createForClass(Issue);
IssueSchema.index({ projectId: 1, status: 1, createdAt: -1 });
IssueSchema.index({ projectId: 1, number: -1 }, { unique: true });
IssueSchema.index({ projectId: 1, status: 1, order: 1 });
IssueSchema.index({ projectId: 1, assigneeId: 1 });
// backlog lists and the active-sprint board: "issues of this project in this sprint (or null), by rank"
IssueSchema.index({ projectId: 1, sprintId: 1, order: 1 });
// Full-text search (3.7). A collection can have only ONE text index, so it covers both fields;
// weights make a match in the title count 10x more than one in the description.
IssueSchema.index({ title: 'text', description: 'text' }, { weights: { title: 10, description: 1 }, name: 'issue_text' });
