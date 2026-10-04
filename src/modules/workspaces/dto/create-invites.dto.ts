import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsIn } from 'class-validator';
import { INVITE_ROLES } from '../schemas/invite.schema.js';
import type { InviteRole } from '../schemas/invite.schema.js';

export class CreateInvitesDto {
  // trim + lowercase every address and drop duplicates before validation
  @Transform(({ value }) =>
    Array.isArray(value)
      ? [...new Set(value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)))]
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true })
  emails: string[];

  @IsIn(INVITE_ROLES)
  role: InviteRole;
}
