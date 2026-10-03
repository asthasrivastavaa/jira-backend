import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const ISSUE_TYPES = ['task', 'bug', 'story', 'epic'] as const;
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

  @Prop({ required: true, unique: true })
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

  @Prop({ type:[ String], default: [] })
 labels: string[];
}

export const IssueSchema = SchemaFactory.createForClass(Issue);
IssueSchema.index({ projectId: 1, status: 1, createdAt: -1 });
IssueSchema.index({ projectId: 1, number: -1 });
