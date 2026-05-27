import { Module, type Provider } from '@nestjs/common';
import { PayrollModule } from '../../integrations/payroll/payroll.module';
import { PayslipController } from './payslip.controller';
import { PayslipService } from './payslip.service';
import { InMemoryPdfGenerator, PDF_GENERATOR } from './pdf.generator';

// In-memory PDF generator for dev/test only. Production needs a real PDF
// library (pdfkit / pdf-lib) and must satisfy Employment Rights Act layout.
const devProviders: Provider[] =
  process.env.NODE_ENV === 'production'
    ? []
    : [{ provide: PDF_GENERATOR, useClass: InMemoryPdfGenerator }];

@Module({
  imports: [PayrollModule],
  controllers: [PayslipController],
  providers: [PayslipService, ...devProviders],
  exports: [PayslipService],
})
export class PayslipModule {}
