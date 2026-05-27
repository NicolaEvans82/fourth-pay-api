import { Injectable } from '@nestjs/common';
import type { PayslipDetailResponse } from './payslip.service';

export const PDF_GENERATOR = Symbol('PdfGenerator');

export interface PdfGenerator {
  generate(payslip: PayslipDetailResponse): Promise<Buffer>;
}

// Minimal-valid PDF for dev / tests. Production impl will use pdfkit or
// pdf-lib and must satisfy Employment Rights Act formatting requirements.
@Injectable()
export class InMemoryPdfGenerator implements PdfGenerator {
  async generate(payslip: PayslipDetailResponse): Promise<Buffer> {
    const header = '%PDF-1.4\n';
    const summary =
      `% Payslip ${payslip.payPeriodStart.toISOString().slice(0, 10)}\n` +
      `% Gross £${payslip.grossPay.toFixed(2)}\n` +
      `% Deductions £${payslip.totalDeductions.toFixed(2)}\n` +
      `% Net £${payslip.netPay.toFixed(2)}\n`;
    const trailer = '%%EOF';
    return Buffer.from(header + summary + trailer);
  }
}
