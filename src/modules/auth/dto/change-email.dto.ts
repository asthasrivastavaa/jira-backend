import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class RequestEmailChangeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  newEmail: string;

  // re-entering the password stops a stolen session from silently taking over the account
  @IsString()
  @MaxLength(72)
  password: string;
}

export class ConfirmEmailChangeDto {
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}
