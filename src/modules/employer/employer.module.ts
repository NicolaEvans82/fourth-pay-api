import { Module } from '@nestjs/common';
import { HrModule } from '../../integrations/hr/hr.module';
import { EwaModule } from '../ewa/ewa.module';
import { EmployerController } from './employer.controller';
import { EmployerStatsService } from './employer-stats.service';

// HrModule exposes HR_ADAPTER (for reading the current accessCapPercent
// via checkEligibility) and EMPLOYER_CONFIG_WRITER (for PATCHing it).
@Module({
  imports: [EwaModule, HrModule],
  controllers: [EmployerController],
  providers: [EmployerStatsService],
})
export class EmployerModule {}
