import { Module } from '@nestjs/common';
import { HrModule } from '../../integrations/hr/hr.module';
import { PayrollModule } from '../../integrations/payroll/payroll.module';
import { BenefitsController } from './benefits.controller';
import { BenefitsService } from './benefits.service';

@Module({
  imports: [HrModule, PayrollModule],
  controllers: [BenefitsController],
  providers: [BenefitsService],
})
export class BenefitsModule {}
