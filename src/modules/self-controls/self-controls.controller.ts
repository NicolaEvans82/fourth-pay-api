import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from '@nestjs/common';
import type { SelfControlsRecord } from '../../database/readers/self-controls.reader';
import {
  OverrideRequestBody,
  PauseRequestBody,
  UpdateSelfControlsBody,
} from './dtos';
import {
  SelfControlsService,
  type AuthContext,
} from './self-controls.service';

// TODO: replace dev headers with Fourth SSO JWT extraction. Role would come
// from the JWT's `role` claim; until auth is wired, x-fourth-role defaults
// to 'employee' so the happy-path API works without extra headers.
const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';
const HEADER_FOURTH_ROLE = 'x-fourth-role';

@Controller('api/v1/self-controls')
export class SelfControlsController {
  constructor(private readonly service: SelfControlsService) {}

  @Get()
  async get(
    @Headers() headers: Record<string, string>,
  ): Promise<SelfControlsRecord> {
    return this.service.get(extractAuthContext(headers));
  }

  @Put()
  async update(
    @Headers() headers: Record<string, string>,
    @Body() body: UpdateSelfControlsBody,
  ): Promise<SelfControlsRecord> {
    return this.service.update(extractAuthContext(headers), body);
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  async pause(
    @Headers() headers: Record<string, string>,
    @Body() body: PauseRequestBody,
  ): Promise<{ pausedUntil: string }> {
    const result = await this.service.pause(
      extractAuthContext(headers),
      body.durationDays,
    );
    return { pausedUntil: result.pausedUntil.toISOString() };
  }

  @Post('override')
  @HttpCode(HttpStatus.OK)
  async override(
    @Headers() headers: Record<string, string>,
    @Body() body: OverrideRequestBody,
  ): Promise<{ overrideToken: string }> {
    return this.service.override(extractAuthContext(headers), body);
  }
}

function extractAuthContext(headers: Record<string, string>): AuthContext {
  const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
  const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
  const roleHeader = headers[HEADER_FOURTH_ROLE] ?? 'employee';
  if (!fourthEmployeeId || !fourthEmployerId) {
    throw new BadRequestException(
      `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
    );
  }
  if (roleHeader !== 'employee' && roleHeader !== 'employer') {
    throw new BadRequestException(
      `Invalid ${HEADER_FOURTH_ROLE} header — must be "employee" or "employer"`,
    );
  }
  return { fourthEmployeeId, fourthEmployerId, role: roleHeader };
}
