import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [PrismaModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}