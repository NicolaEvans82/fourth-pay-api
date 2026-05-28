import { Module } from '@nestjs/common';
import { HrModule } from '../../integrations/hr/hr.module';
import { PayrollModule } from '../../integrations/payroll/payroll.module';
import { PensionController } from './pension.controller';
import { PensionService } from './pension.service';

@Module({
  imports: [HrModule, PayrollModule],
  controllers: [PensionController],
  providers: [PensionService],
})
export class PensionModule {}
