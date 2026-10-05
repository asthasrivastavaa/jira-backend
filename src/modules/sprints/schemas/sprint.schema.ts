import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const SPRINT_STATUSES = ['planned', 'active', 'completed'] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

/** Frozen when the sprint completes, so velocity (5.3) doesn't change if issues are edited later. */
export class SprintSummary {
  doneIssues: number;
  doneStoryPoints: number;
  movedIssues: number;
}

export type SprintDocument = HydratedDocument<Sprint>;

@Schema({ timestamps: true })
export class Sprint {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 60 })
  name: string;

  @Prop({ trim: true, maxlength: 500, default: '' })
  goal: string;

  @Prop({ type: String, enum: SPRINT_STATUSES, default: 'planned' })
  status: SprintStatus;

  // calendar days (UTC midnight), like issue due dates
  @Prop({ type: Date, default: null })
  startDate: Date | null;

  @Prop({ type: Date, default: null })
  endDate: Date | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: { _id: false, doneIssues: Number, doneStoryPoints: Number, movedIssues: Number }, default: null })
  summary: SprintSummary | null;
}

export const SprintSchema = SchemaFactory.createForClass(Sprint);
SprintSchema.index({ projectId: 1, status: 1, createdAt: 1 });
// "At most ONE active sprint per project", enforced by the database itself:
// a unique index that only contains documents with status 'active' (a PARTIAL index).
// Two people pressing "Start sprint" at the same moment can't both win; the second gets E11000.
SprintSchema.index(
  { projectId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_active_sprint_per_project' },
);
