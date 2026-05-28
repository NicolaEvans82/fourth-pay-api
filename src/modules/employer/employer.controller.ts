import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Optional,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import type { EmployerStatsResponse } from './dtos';
import { EmployerStatsService } from './employer-stats.service';

const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/employer')
export class EmployerController {
  constructor(
    private readonly service: EmployerStatsService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get('stats')
  async stats(
    @Headers() headers: Record<string, string>,
  ): Promise<EmployerStatsResponse> {
    const employerId = headers[HEADER_FOURTH_EMPLOYER_ID];
    if (!employerId) {
      throw new BadRequestException(
        `Missing required header: ${HEADER_FOURTH_EMPLOYER_ID}`,
      );
    }
    const stats = await this.service.getStats(employerId);
    // No employee_id on this event — the employer dashboard is
    // workforce-aggregate only (CLAUDE.md rule 5).
    this.iq360?.emit('employer.dashboard.viewed', { employer_id: employerId });
    return stats;
  }
}
