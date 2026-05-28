import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EMPLOYEE_ACCOUNT_READER,
  type EmployeeAccount,
  type EmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import {
  SELF_CONTROLS_READER,
  type SelfControlsReader,
  type SelfControlsRecord,
} from '../../database/readers/self-controls.reader';
import {
  AUDIT_LOG_WRITER,
  type AuditLogWriter,
} from '../../database/writers/audit-log.writer';
import {
  SELF_CONTROLS_WRITER,
  type SelfControlsWriter,
} from '../../database/writers/self-controls.writer';
import {
  HR_ADAPTER,
  type EmployerConfig,
  type HrAdapter,
} from '../../integrations/hr/hr.adapter';

export interface AuthContext {
  fourthEmployeeId: string;
  fourthEmployerId: string;
  role: 'employee' | 'employer';
}

export interface UpdateSelfControlsInput {
  monthlyLimitEnabled?: boolean;
  monthlyLimitAmount?: number | null;
  perTransferLimitEnabled?: boolean;
  perTransferLimitAmount?: number | null;
  coolingOffEnabled?: boolean;
  coolingOffHours?: number;
  autoSaveEnabled?: boolean;
  autoSavePercent?: number;
  wellbeingNudgesEnabled?: boolean;
}

export interface OverrideInput {
  controlType: string;
  reason: string;
}

@Injectable()
export class SelfControlsService {
  constructor(
    @Inject(EMPLOYEE_ACCOUNT_READER)
    private readonly employees: EmployeeAccountReader,
    @Inject(HR_ADAPTER) private readonly hr: HrAdapter,
    @Inject(SELF_CONTROLS_READER)
    private readonly reader: SelfControlsReader,
    @Inject(SELF_CONTROLS_WRITER)
    private readonly writer: SelfControlsWriter,
    @Inject(AUDIT_LOG_WRITER) private readonly audit: AuditLogWriter,
  ) {}

  async get(ctx: AuthContext): Promise<SelfControlsRecord> {
    this.assertEmployeeRole(ctx);
    const employee = await this.findEmployee(ctx.fourthEmployeeId);
    return (
      (await this.reader.findByEmployeeAccountId(employee.id)) ??
      defaultRecord(employee.id)
    );
  }

  async update(
    ctx: AuthContext,
    patch: UpdateSelfControlsInput,
  ): Promise<SelfControlsRecord> {
    this.assertEmployeeRole(ctx);
    const employee = await this.findEmployee(ctx.fourthEmployeeId);
    const eligibility = await this.hr.checkEligibility({
      fourthEmployeeId: ctx.fourthEmployeeId,
      fourthEmployerId: ctx.fourthEmployerId,
    });

    const current =
      (await this.reader.findByEmployeeAccountId(employee.id)) ??
      defaultRecord(employee.id);
    // Drop undefined keys so an absent optional field in the PUT body
    // doesn't clobber the stored value (class-transformer materialises
    // declared-but-unset properties as undefined with TS class fields).
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    const next: SelfControlsRecord = { ...current, ...definedPatch };

    if (
      next.monthlyLimitAmount !== null &&
      next.monthlyLimitAmount > monthlyLimitMax(eligibility.employerConfig)
    ) {
      throw new BadRequestException({
        code: 'EWA_MONTHLY_LIMIT_ABOVE_EMPLOYER_MAX',
        message: 'Monthly limit exceeds the employer-configured maximum.',
      });
    }

    const saved = await this.writer.upsert(next);

    await this.audit.append({
      employeeAccountId: employee.id,
      eventType: 'self_control_changed',
      eventData: { patch },
    });

    return saved;
  }

  async pause(
    ctx: AuthContext,
    durationDays: number,
  ): Promise<{ pausedUntil: Date }> {
    this.assertEmployeeRole(ctx);
    const employee = await this.findEmployee(ctx.fourthEmployeeId);

    const pausedUntil = new Date(
      Date.now() + durationDays * 24 * 60 * 60 * 1000,
    );
    const current =
      (await this.reader.findByEmployeeAccountId(employee.id)) ??
      defaultRecord(employee.id);
    await this.writer.upsert({ ...current, pausedUntil });

    await this.audit.append({
      employeeAccountId: employee.id,
      eventType: 'account_paused',
      eventData: { durationDays, pausedUntil: pausedUntil.toISOString() },
    });

    return { pausedUntil };
  }

  async override(
    ctx: AuthContext,
    body: OverrideInput,
  ): Promise<{ overrideToken: string }> {
    this.assertEmployeeRole(ctx);

    if (!body.reason || body.reason.trim().length === 0) {
      throw new BadRequestException({
        code: 'EWA_OVERRIDE_REASON_REQUIRED',
        message: 'Override requires a reason.',
      });
    }

    const employee = await this.findEmployee(ctx.fourthEmployeeId);
    const overrideToken = randomUUID();

    await this.audit.append({
      employeeAccountId: employee.id,
      eventType: 'self_control_override',
      eventData: {
        controlType: body.controlType,
        reason: body.reason,
        overrideToken,
      },
    });

    return { overrideToken };
  }

  private assertEmployeeRole(ctx: AuthContext): void {
    if (ctx.role !== 'employee') {
      throw new ForbiddenException({
        code: 'EWA_EMPLOYER_CANNOT_ACCESS_SELF_CONTROLS',
        message: 'Self-controls are employee-only.',
      });
    }
  }

  private async findEmployee(faid: string): Promise<EmployeeAccount> {
    const employee = await this.employees.findByFourthEmployeeId(faid);
    if (!employee) {
      throw new NotFoundException(
        'Employee account not enrolled in Fourth Pay',
      );
    }
    return employee;
  }
}

// Heuristic placeholder — see CLAUDE.md design notes. Proper computation
// requires the employee's net-pay estimate; current rule treats employer's
// maxAccessPercent as a £ multiplier (50% → £1000 monthly limit cap).
function monthlyLimitMax(config: EmployerConfig): number {
  return config.maxAccessPercent * 20;
}

function defaultRecord(employeeAccountId: string): SelfControlsRecord {
  return {
    employeeAccountId,
    monthlyLimitEnabled: true,
    monthlyLimitAmount: 200,
    perTransferLimitEnabled: false,
    perTransferLimitAmount: null,
    coolingOffEnabled: false,
    coolingOffHours: 48,
    autoSaveEnabled: false,
    autoSavePercent: 10,
    wellbeingNudgesEnabled: true,
    pausedUntil: null,
  };
}
