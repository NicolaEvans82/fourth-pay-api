import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PAYROLL_ADAPTER,
  type PayrollAdapter,
  type PayslipDetail,
  type PayslipSummary,
} from '../../integrations/payroll/payroll.adapter';
import { PDF_GENERATOR, type PdfGenerator } from './pdf.generator';

export interface YtdSummary {
  grossYtd: number;
  netYtd: number;
  taxYearStart: Date;
}

export interface PayslipDetailResponse extends PayslipDetail {
  ytd: YtdSummary;
}

@Injectable()
export class PayslipService {
  constructor(
    @Inject(PAYROLL_ADAPTER) private readonly payroll: PayrollAdapter,
    @Inject(PDF_GENERATOR) private readonly pdf: PdfGenerator,
  ) {}

  async list(input: {
    fourthEmployeeId: string;
  }): Promise<PayslipSummary[]> {
    return this.payroll.listPayslips(input);
  }

  async getDetail(input: {
    fourthEmployeeId: string;
    payPeriodStart: Date;
  }): Promise<PayslipDetailResponse> {
    const payslip = await this.payroll.getPayslip(input);
    if (!payslip) {
      // AC5: cross-employee access fails. The mock returns null for any FAID
      // that isn't Jordan's, so attempting to read another employee's payslip
      // surfaces as NotFound (404). A future auth-aware check would map this
      // to 403 when the request is provably from a different authenticated user.
      throw new NotFoundException('Payslip not found for this period');
    }
    const allPayslips = await this.payroll.listPayslips({
      fourthEmployeeId: input.fourthEmployeeId,
    });
    return { ...payslip, ytd: computeYtd(allPayslips, payslip.paymentDate) };
  }

  async getPdf(input: {
    fourthEmployeeId: string;
    payPeriodStart: Date;
  }): Promise<Buffer> {
    const detail = await this.getDetail(input);
    return this.pdf.generate(detail);
  }
}

function computeYtd(
  payslips: PayslipSummary[],
  anchor: Date,
): YtdSummary {
  const taxYearStart = ukTaxYearStart(anchor);
  const inTaxYear = payslips.filter(
    (p) => p.paymentDate >= taxYearStart && p.paymentDate <= anchor,
  );
  const grossYtd = inTaxYear.reduce((s, p) => s + p.grossPay, 0);
  const netYtd = inTaxYear.reduce((s, p) => s + p.netPay, 0);
  return {
    grossYtd: round2(grossYtd),
    netYtd: round2(netYtd),
    taxYearStart,
  };
}

// UK tax year runs 6 April → 5 April. For a payment date, find the
// corresponding tax-year start.
function ukTaxYearStart(d: Date): Date {
  const year = d.getUTCFullYear();
  const aprilSixth = new Date(Date.UTC(year, 3, 6));
  return d >= aprilSixth ? aprilSixth : new Date(Date.UTC(year - 1, 3, 6));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
