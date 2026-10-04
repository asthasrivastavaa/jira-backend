import { IsIn } from 'class-validator';
import { INVITE_ROLES } from '../schemas/invite.schema.js';
import type { InviteRole } from '../schemas/invite.schema.js';

// 'owner' is deliberately not allowed: ownership moves only through the transfer flow (2.8)
export class UpdateMemberRoleDto {
  @IsIn(INVITE_ROLES)
  role: InviteRole;
}
