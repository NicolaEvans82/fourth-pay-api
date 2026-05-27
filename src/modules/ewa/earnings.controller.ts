import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
} from '@nestjs/common';
import { EarningsService } from './earnings.service';

interface EarningsShiftJson {
  elementName: string;
  startDateTime: string;
  endDateTime: string;
  hours: number;
  rate: number;
  value: number;
}

interface EarningsJson {
  payPeriodStart: string;
  payPeriodEnd: string;
  shifts: EarningsShiftJson[];
  summary: {
    grossEarned: number;
    availableAmount: number | null;
    accessedAmount: number;
  };
}

@Controller('api/v1/ewa/earnings')
export class EarningsController {
  constructor(private readonly service: EarningsService) {}

  @Get()
  async getEarnings(
    @Headers() headers: Record<string, string>,
    @Query('pay_period_start') payPeriodStartRaw?: string,
  ): Promise<EarningsJson> {
    const fourthEmployeeId = headers['x-fourth-employee-id'];
    const fourthEmployerId = headers['x-fourth-employer-id'];
    if (!fourthEmployeeId || !fourthEmployerId) {
      throw new BadRequestException(
        'Missing required headers: x-fourth-employee-id, x-fourth-employer-id',
      );
    }
    const payPeriodStart = payPeriodStartRaw
      ? new Date(payPeriodStartRaw)
      : undefined;
    const earnings = await this.service.getEarnings({
      fourthEmployeeId,
      fourthEmployerId,
      payPeriodStart,
    });
    return {
      payPeriodStart: earnings.payPeriodStart.toISOString(),
      payPeriodEnd: earnings.payPeriodEnd.toISOString(),
      shifts: earnings.shifts.map((s) => ({
        elementName: s.elementName,
        startDateTime: s.startDateTime.toISOString(),
        endDateTime: s.endDateTime.toISOString(),
        hours: s.hours,
        rate: s.rate,
        value: s.value,
      })),
      summary: earnings.summary,
    };
  }
}
