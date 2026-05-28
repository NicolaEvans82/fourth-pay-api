import { Module } from '@nestjs/common';
import { PayrollModule } from '../../integrations/payroll/payroll.module';
import { PayslipController } from './payslip.controller';
import { PayslipService } from './payslip.service';
import { InMemoryPdfGenerator, PDF_GENERATOR } from './pdf.generator';

// In-memory PDF generator until a real Employment-Rights-Act-compliant
// generator lands.
@Module({
  imports: [PayrollModule],
  controllers: [PayslipController],
  providers: [
    PayslipService,
    { provide: PDF_GENERATOR, useClass: InMemoryPdfGenerator },
  ],
  exports: [PayslipService],
})
export class PayslipModule {}
