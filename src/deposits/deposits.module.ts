import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';

@Module({
  imports: [PrismaModule],
  controllers: [DepositsController],
  providers: [DepositsService],
})
export class DepositsModule {}