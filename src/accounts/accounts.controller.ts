import { Controller, Get, Param, Query } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { ListEntriesDto } from './dto/list-entries.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get(':id/balance')
  getBalance(@Param('id') id: string) {
    return this.accounts.getBalance(id);
  }

  @Get(':id/statement')
  listEntries(@Param('id') id: string, @Query() query: ListEntriesDto) {
    return this.accounts.listEntries(id, query);
  }
}