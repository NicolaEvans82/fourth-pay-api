import { Test, type TestingModule } from '@nestjs/testing';
import {
  EWA_TRANSFER_READER,
  EWA_TRANSFER_WRITER,
  InMemoryEwaTransferStore,
} from '../../database/ewa-transfer.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  MockEmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import { SELF_CONTROLS_READER } from '../../database/readers/self-controls.reader';
import { InMemorySelfControlsStore } from '../../database/self-controls.store';
import {
  AUDIT_LOG_WRITER,
  InMemoryAuditLogWriter,
} from '../../database/writers/audit-log.writer';
import {
  EWA_DEDUCTION_QUEUE_WRITER,
  InMemoryEwaDeductionQueueWriter,
} from '../../database/writers/ewa-deduction-queue.writer';
import { SELF_CONTROLS_WRITER } from '../../database/writers/self-controls.writer';
import { HR_ADAPTER } from '../../integrations/hr/hr.adapter';
import {
  CROWN_PUB_GROUP_EMPLOYER_ID,
  MockHrAdapter,
} from '../../integrations/hr/hr.mock';
import { PAYROLL_ADAPTER } from '../../integrations/payroll/payroll.adapter';
import { MockPayrollAdapter } from '../../integrations/payroll/payroll.mock';
import { WFM_ADAPTER } from '../../integrations/wfm/wfm.adapter';
import {
  JORDAN_HARRIS_FAID,
  MockWfmAdapter,
} from '../../integrations/wfm/wfm.mock';
import { TransferService } from '../ewa/transfer.service';
import {
  AUTO_SAVE_SINK,
  InMemoryAutoSaveSink,
} from '../savings/auto-save.sink';
import {
  SelfControlsService,
  type AuthContext,
} from './self-controls.service';

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      SelfControlsService,
      TransferService,
      { provide: WFM_ADAPTER, useClass: MockWfmAdapter },
      { provide: HR_ADAPTER, useClass: MockHrAdapter },
      { provide: PAYROLL_ADAPTER, useClass: MockPayrollAdapter },
      {
        provide: EMPLOYEE_ACCOUNT_READER,
        useClass: MockEmployeeAccountReader,
      },
      InMemorySelfControlsStore,
      { provide: SELF_CONTROLS_READER, useExisting: InMemorySelfControlsStore },
      { provide: SELF_CONTROLS_WRITER, useExisting: InMemorySelfControlsStore },
      InMemoryEwaTransferStore,
      { provide: EWA_TRANSFER_READER, useExisting: InMemoryEwaTransferStore },
      { provide: EWA_TRANSFER_WRITER, useExisting: InMemoryEwaTransferStore },
      { provide: AUDIT_LOG_WRITER, useClass: InMemoryAuditLogWriter },
      {
        provide: EWA_DEDUCTION_QUEUE_WRITER,
        useClass: InMemoryEwaDeductionQueueWriter,
      },
      { provide: AUTO_SAVE_SINK, useClass: InMemoryAutoSaveSink },
    ],
  }).compile();
}

const employeeCtx: AuthContext = {
  fourthEmployeeId: JORDAN_HARRIS_FAID,
  fourthEmployerId: CROWN_PUB_GROUP_EMPLOYER_ID,
  role: 'employee',
};

const employerCtx: AuthContext = {
  fourthEmployeeId: JORDAN_HARRIS_FAID,
  fourthEmployerId: CROWN_PUB_GROUP_EMPLOYER_ID,
  role: 'employer',
};

describe('ewa_self_controls (Spec 2) — acceptance criteria', () => {
  it('employer cannot read self-controls endpoint', async () => {
    const module = await buildModule();
    const service = module.get(SelfControlsService);
    await expect(service.get(employerCtx)).rejects.toMatchObject({
      response: { code: 'EWA_EMPLOYER_CANNOT_ACCESS_SELF_CONTROLS' },
    });
  });

  it('monthly limit above employer max returns validation error', async () => {
    const module = await buildModule();
    const service = module.get(SelfControlsService);
    await expect(
      service.update(employeeCtx, { monthlyLimitAmount: 5000 }),
    ).rejects.toMatchObject({
      response: { code: 'EWA_MONTHLY_LIMIT_ABOVE_EMPLOYER_MAX' },
    });
  });

  it('cooling-off override without reason returns validation error', async () => {
    const module = await buildModule();
    const service = module.get(SelfControlsService);
    await expect(
      service.override(employeeCtx, { controlType: 'cooling_off', reason: '' }),
    ).rejects.toMatchObject({
      response: { code: 'EWA_OVERRIDE_REASON_REQUIRED' },
    });
  });

  it('cooling-off override with reason writes audit record with reason', async () => {
    const module = await buildModule();
    const service = module.get(SelfControlsService);
    const auditLog = module.get<InMemoryAuditLogWriter>(AUDIT_LOG_WRITER);
    await service.override(employeeCtx, {
      controlType: 'cooling_off',
      reason: 'family emergency',
    });
    const overrideEvents = auditLog.events.filter(
      (e) => e.eventType === 'self_control_override',
    );
    expect(overrideEvents).toHaveLength(1);
    expect(overrideEvents[0].eventData).toMatchObject({
      controlType: 'cooling_off',
      reason: 'family emergency',
    });
  });

  it('pause sets correct paused_until timestamp', async () => {
    const module = await buildModule();
    const service = module.get(SelfControlsService);
    const before = Date.now();
    const result = await service.pause(employeeCtx, 30);
    const expectedMs = before + 30 * 24 * 60 * 60 * 1000;
    expect(result.pausedUntil.getTime()).toBeGreaterThanOrEqual(
      expectedMs - 1000,
    );
    expect(result.pausedUntil.getTime()).toBeLessThanOrEqual(
      expectedMs + 1000,
    );
  });

  it('self-control change always writes to audit log', async () => {
    const module = await buildModule();
    const service = module.get(SelfControlsService);
    const auditLog = module.get<InMemoryAuditLogWriter>(AUDIT_LOG_WRITER);
    await service.update(employeeCtx, { wellbeingNudgesEnabled: false });
    expect(auditLog.events.map((e) => e.eventType)).toContain(
      'self_control_changed',
    );
  });

  it('auto-save transfer fires on ewa_transfer_completed if enabled', async () => {
    const module = await buildModule();
    const selfControls = module.get(SelfControlsService);
    const transferService = module.get(TransferService);
    const autoSave = module.get<InMemoryAutoSaveSink>(AUTO_SAVE_SINK);

    await selfControls.update(employeeCtx, {
      autoSaveEnabled: true,
      autoSavePercent: 10,
    });

    await transferService.executeTransfer({
      fourthEmployeeId: JORDAN_HARRIS_FAID,
      fourthEmployerId: CROWN_PUB_GROUP_EMPLOYER_ID,
      amount: 50,
      transferSpeed: 'instant',
      bankAccountId: null,
      fcaDisclosureAcknowledged: true,
    });

    expect(autoSave.triggered).toHaveLength(1);
    expect(autoSave.triggered[0].savedAmount).toBe(5);
  });
});
