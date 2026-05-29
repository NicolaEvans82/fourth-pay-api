import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Optional,
  Patch,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import {
  EMPLOYER_CONFIG_WRITER,
  HR_ADAPTER,
  type EmployerConfigWriter,
  type HrAdapter,
} from '../../integrations/hr/hr.adapter';
import type {
  EmployerConfigResponse,
  EmployerStatsResponse,
} from './dtos';
import { UpdateEmployerConfigBody } from './dtos';
import { EmployerStatsService } from './employer-stats.service';

const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/employer')
export class EmployerController {
  constructor(
    private readonly service: EmployerStatsService,
    @Inject(HR_ADAPTER) private readonly hr: HrAdapter,
    @Inject(EMPLOYER_CONFIG_WRITER)
    private readonly configWriter: EmployerConfigWriter,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get('stats')
  async stats(
    @Headers() headers: Record<string, string>,
  ): Promise<EmployerStatsResponse> {
    const employerId = extractEmployerId(headers);
    const stats = await this.service.getStats(employerId);
    // No employee_id on this event — the employer dashboard is
    // workforce-aggregate only (CLAUDE.md rule 5).
    this.iq360?.emit('employer.dashboard.viewed', { employer_id: employerId });
    return stats;
  }

  @Get('config')
  async getConfig(
    @Headers() headers: Record<string, string>,
  ): Promise<EmployerConfigResponse> {
    const employerId = extractEmployerId(headers);
    // checkEligibility is the only existing path that returns the
    // employer config; using a synthetic employee id avoids needing
    // a new HR method. The eligibility outcome is discarded — we
    // only care about the employerConfig piece.
    const result = await this.hr.checkEligibility({
      fourthEmployeeId: '__system__',
      fourthEmployerId: employerId,
    });
    return {
      employer_id: employerId,
      access_cap_percent: result.employerConfig.accessCapPercent,
    };
  }

  @Patch('config')
  async updateConfig(
    @Headers() headers: Record<string, string>,
    @Body() body: UpdateEmployerConfigBody,
  ): Promise<EmployerConfigResponse> {
    const employerId = extractEmployerId(headers);
    const updated = await this.configWriter.updateConfig({
      fourthEmployerId: employerId,
      accessCapPercent: body.access_cap_percent,
    });
    this.iq360?.emit('employer.config.updated', {
      employer_id: employerId,
      properties: { access_cap_percent: updated.accessCapPercent },
    });
    return {
      employer_id: employerId,
      access_cap_percent: updated.accessCapPercent,
    };
  }
}

function extractEmployerId(headers: Record<string, string>): string {
  const employerId = headers[HEADER_FOURTH_EMPLOYER_ID];
  if (!employerId) {
    throw new BadRequestException(
      `Missing required header: ${HEADER_FOURTH_EMPLOYER_ID}`,
    );
  }
  return employerId;
}
