import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const INVITE_ROLES = ['admin', 'member', 'viewer'] as const;
export const INVITE_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export type InviteDocument = HydratedDocument<Invite>;

@Schema({ timestamps: true })
export class Invite {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Workspace', required: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, enum: INVITE_ROLES, required: true })
  role: InviteRole;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: String, enum: INVITE_STATUSES, default: 'pending' })
  status: InviteStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  invitedById: Types.ObjectId;
}

export const InviteSchema = SchemaFactory.createForClass(Invite);
InviteSchema.index({ workspaceId: 1, email: 1, status: 1 });
