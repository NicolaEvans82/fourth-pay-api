import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Optional,
  Query,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
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
  constructor(
    private readonly service: EarningsService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

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
    this.iq360?.emit('earnings.tracker.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
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
