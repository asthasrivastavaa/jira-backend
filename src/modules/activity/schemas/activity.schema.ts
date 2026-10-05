import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const ACTIVITY_TYPES = ['created', 'updated'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/**
 * One changed field. `from`/`to` are DISPLAY SNAPSHOTS taken at the time of the change
 * ("Ana", ["Backend","UI"], "2026-10-10"), not ids: if Ana is renamed or the label deleted later,
 * the history still shows what it showed then. An audit log describes the past; it must not change with the present.
 */
export class FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export type ActivityDocument = HydratedDocument<Activity>;

// Append-only: entries are created and (with their issue) deleted, never updated. No updatedAt needed.
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Activity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Issue', required: true })
  issueId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  @Prop({ type: String, enum: ACTIVITY_TYPES, required: true })
  type: ActivityType;

  @Prop({ type: [{ _id: false, field: String, from: MongooseSchema.Types.Mixed, to: MongooseSchema.Types.Mixed }], default: [] })
  changes: FieldChange[];
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
ActivitySchema.index({ issueId: 1, _id: -1 });
