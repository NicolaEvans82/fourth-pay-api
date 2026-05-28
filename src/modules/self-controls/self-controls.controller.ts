import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Optional,
  Post,
  Put,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
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
  constructor(
    private readonly service: SelfControlsService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

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
    const ctx = extractAuthContext(headers);
    const result = await this.service.update(ctx, body);
    // Only emit field names — never the new values themselves, since
    // surfacing 'monthlyLimitAmount=100' in an event payload would
    // start to leak per-employee financial state.
    // Filter to keys with defined values — the DTO class materialises
    // every declared field as `undefined` so a naive Object.keys(body)
    // emits the full schema rather than the keys the caller actually
    // sent.
    const fieldsChanged = Object.entries(body)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);
    this.iq360?.emit('ewa.self_control.updated', {
      employee_id: ctx.fourthEmployeeId,
      employer_id: ctx.fourthEmployerId,
      properties: { fields_changed: fieldsChanged },
    });
    return result;
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  async pause(
    @Headers() headers: Record<string, string>,
    @Body() body: PauseRequestBody,
  ): Promise<{ pausedUntil: string }> {
    const ctx = extractAuthContext(headers);
    const result = await this.service.pause(ctx, body.durationDays);
    this.iq360?.emit('ewa.account.paused', {
      employee_id: ctx.fourthEmployeeId,
      employer_id: ctx.fourthEmployerId,
      properties: { duration_days: body.durationDays },
    });
    return { pausedUntil: result.pausedUntil.toISOString() };
  }

  @Post('override')
  @HttpCode(HttpStatus.OK)
  async override(
    @Headers() headers: Record<string, string>,
    @Body() body: OverrideRequestBody,
  ): Promise<{ overrideToken: string }> {
    const ctx = extractAuthContext(headers);
    const result = await this.service.override(ctx, body);
    // `reason` is free-text and could carry personal context — only the
    // control_type bucket goes into iQ360. The full reason still lands
    // in audit_log via SelfControlsService.
    this.iq360?.emit('ewa.self_control.override', {
      employee_id: ctx.fourthEmployeeId,
      employer_id: ctx.fourthEmployerId,
      properties: { control_type: body.controlType },
    });
    return result;
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
