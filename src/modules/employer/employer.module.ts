import { Module } from '@nestjs/common';
import { EwaModule } from '../ewa/ewa.module';
import { EmployerController } from './employer.controller';
import { EmployerStatsService } from './employer-stats.service';

@Module({
  imports: [EwaModule],
  controllers: [EmployerController],
  providers: [EmployerStatsService],
})
export class EmployerModule {}
