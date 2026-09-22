import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateTransferDto {
  @IsString()
  idempotencyKey: string;

  @IsString()
  fromAccountId: string;

  @IsString()
  toAccountId: string;

  @IsInt()
  @IsPositive()
  amountCents: number;

  @IsOptional()
  @IsString()
  description?: string;
}