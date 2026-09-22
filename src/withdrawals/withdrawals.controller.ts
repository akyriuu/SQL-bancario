import { Body, Controller, Post } from '@nestjs/common';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalsService } from './withdrawals.service';

@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  create(@Body() dto: CreateWithdrawalDto) {
    return this.withdrawals.create(dto);
  }
}