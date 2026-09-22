import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateWithdrawalDto {
  @IsString()
  idempotencyKey: string;

  @IsString()
  accountId: string;

  @IsInt()
  @IsPositive()
  amountCents: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}