import { Body, Controller, Post } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { CreateDepositDto } from './dto/create-deposit.dto';

@Controller('deposits')
export class DepositsController {
  constructor(private readonly deposits: DepositsService) {}

  @Post()
  create(@Body() dto: CreateDepositDto) {
    return this.deposits.create(dto);
  }
}