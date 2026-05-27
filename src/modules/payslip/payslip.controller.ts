import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  StreamableFile,
} from '@nestjs/common';
import {
  PayslipService,
  type PayslipDetailResponse,
} from './payslip.service';
import type { PayslipSummary } from '../../integrations/payroll/payroll.adapter';

@Controller('api/v1/payslips')
export class PayslipController {
  constructor(private readonly service: PayslipService) {}

  @Get()
  async list(
    @Headers() headers: Record<string, string>,
  ): Promise<{ payslips: PayslipSummary[] }> {
    const fourthEmployeeId = extractEmployeeId(headers);
    const payslips = await this.service.list({ fourthEmployeeId });
    return { payslips };
  }

  @Get(':payPeriodStart')
  async getDetail(
    @Headers() headers: Record<string, string>,
    @Param('payPeriodStart') payPeriodStartRaw: string,
  ): Promise<PayslipDetailResponse> {
    const fourthEmployeeId = extractEmployeeId(headers);
    return this.service.getDetail({
      fourthEmployeeId,
      payPeriodStart: parsePeriodStart(payPeriodStartRaw),
    });
  }

  @Get(':payPeriodStart/pdf')
  async getPdf(
    @Headers() headers: Record<string, string>,
    @Param('payPeriodStart') payPeriodStartRaw: string,
  ): Promise<StreamableFile> {
    const fourthEmployeeId = extractEmployeeId(headers);
    const buffer = await this.service.getPdf({
      fourthEmployeeId,
      payPeriodStart: parsePeriodStart(payPeriodStartRaw),
    });
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="payslip-${payPeriodStartRaw}.pdf"`,
    });
  }
}

function extractEmployeeId(headers: Record<string, string>): string {
  const fourthEmployeeId = headers['x-fourth-employee-id'];
  if (!fourthEmployeeId) {
    throw new BadRequestException(
      'Missing required header: x-fourth-employee-id',
    );
  }
  return fourthEmployeeId;
}

function parsePeriodStart(raw: string): Date {
  const date = new Date(raw);
  if (isNaN(date.getTime())) {
    throw new BadRequestException(
      `Invalid payPeriodStart: ${raw} — expected YYYY-MM-DD`,
    );
  }
  return date;
}
