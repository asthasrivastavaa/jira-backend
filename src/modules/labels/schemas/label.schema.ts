import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b',
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

/** case-insensitive comparison: "Bug" and "bug" are the same label */
export const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

export type LabelDocument = HydratedDocument<Label>;

@Schema({ timestamps: true })
export class Label {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 30 })
  name: string;

  @Prop({ type: String, required: true, enum: LABEL_COLORS })
  color: LabelColor;
}

export const LabelSchema = SchemaFactory.createForClass(Label);
LabelSchema.index({ projectId: 1, name: 1 }, { unique: true, collation: CASE_INSENSITIVE });
