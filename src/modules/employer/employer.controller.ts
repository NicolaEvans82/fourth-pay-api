import { BadRequestException, Controller, Get, Headers } from '@nestjs/common';
import type { EmployerStatsResponse } from './dtos';
import { EmployerStatsService } from './employer-stats.service';

const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/employer')
export class EmployerController {
  constructor(private readonly service: EmployerStatsService) {}

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
    return this.service.getStats(employerId);
  }
}
