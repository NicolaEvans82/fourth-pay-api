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
import {
  SELF_CONTROLS_READER,
  MockSelfControlsReader,
  type SelfControlsReader,
} from '../../database/readers/self-controls.reader';
import {
  AUDIT_LOG_WRITER,
  InMemoryAuditLogWriter,
} from '../../database/writers/audit-log.writer';
import {
  EWA_DEDUCTION_QUEUE_WRITER,
  InMemoryEwaDeductionQueueWriter,
} from '../../database/writers/ewa-deduction-queue.writer';
import { HR_ADAPTER, type HrAdapter } from '../../integrations/hr/hr.adapter';
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
import { TransferService } from './transfer.service';

interface ProviderOverride {
  token: symbol;
  value: unknown;
}

async function buildModule(
  overrides: ProviderOverride[] = [],
): Promise<TestingModule> {
  let builder = Test.createTestingModule({
    providers: [
      TransferService,
      { provide: WFM_ADAPTER, useClass: MockWfmAdapter },
      { provide: HR_ADAPTER, useClass: MockHrAdapter },
      { provide: PAYROLL_ADAPTER, useClass: MockPayrollAdapter },
      {
        provide: EMPLOYEE_ACCOUNT_READER,
        useClass: MockEmployeeAccountReader,
      },
      { provide: SELF_CONTROLS_READER, useClass: MockSelfControlsReader },
      InMemoryEwaTransferStore,
      { provide: EWA_TRANSFER_READER, useExisting: InMemoryEwaTransferStore },
      { provide: EWA_TRANSFER_WRITER, useExisting: InMemoryEwaTransferStore },
      { provide: AUDIT_LOG_WRITER, useClass: InMemoryAuditLogWriter },
      {
        provide: EWA_DEDUCTION_QUEUE_WRITER,
        useClass: InMemoryEwaDeductionQueueWriter,
      },
    ],
  });

  for (const override of overrides) {
    builder = builder.overrideProvider(override.token).useValue(override.value);
  }

  return builder.compile();
}

const validInput = {
  fourthEmployeeId: JORDAN_HARRIS_FAID,
  fourthEmployerId: CROWN_PUB_GROUP_EMPLOYER_ID,
  amount: 50,
  transferSpeed: 'instant' as const,
  bankAccountId: null,
  fcaDisclosureAcknowledged: true,
};

const SUBSIDISED_HR: HrAdapter = {
  async checkEligibility(input) {
    return {
      eligible: true,
      faid: input.fourthEmployeeId,
      paybasis: 'monthly',
      employerConfig: {
        fourthEmployerId: input.fourthEmployerId,
        maxAccessPercent: 50,
        feeSubsidised: true,
        minTenureDays: 0,
        enabled: true,
        payrollLockdownStartDay: 27,
        payrollLockdownEndDay: 31,
      },
    };
  },
};

const NO_LIMITS_SELF_CONTROLS: SelfControlsReader = {
  async findByEmployeeAccountId(employeeAccountId) {
    return {
      employeeAccountId,
      monthlyLimitEnabled: false,
      monthlyLimitAmount: null,
      perTransferLimitEnabled: false,
      perTransferLimitAmount: null,
      coolingOffEnabled: false,
      coolingOffHours: 48,
      pausedUntil: null,
    };
  },
};

const COOLING_OFF_SELF_CONTROLS: SelfControlsReader = {
  async findByEmployeeAccountId(employeeAccountId) {
    return {
      employeeAccountId,
      monthlyLimitEnabled: true,
      monthlyLimitAmount: 200,
      perTransferLimitEnabled: false,
      perTransferLimitAmount: null,
      coolingOffEnabled: true,
      coolingOffHours: 48,
      pausedUntil: null,
    };
  },
};

describe('ewa_core_transfer (Spec 1) — acceptance criteria', () => {
  it('employee cannot submit transfer without fca_disclosure_acknowledged true', async () => {
    const module = await buildModule();
    const service = module.get(TransferService);

    await expect(
      service.executeTransfer({
        ...validInput,
        fcaDisclosureAcknowledged: false,
      }),
    ).rejects.toMatchObject({
      response: { code: 'EWA_FCA_DISCLOSURE_REQUIRED' },
    });
  });

  it('transfer with amount exceeding available balance returns EWA_INSUFFICIENT_BALANCE', async () => {
    const module = await buildModule([
      { token: SELF_CONTROLS_READER, value: NO_LIMITS_SELF_CONTROLS },
    ]);
    const service = module.get(TransferService);

    await expect(
      service.executeTransfer({ ...validInput, amount: 300 }),
    ).rejects.toMatchObject({
      response: { code: 'EWA_INSUFFICIENT_BALANCE' },
    });
  });

  it('transfer with cooling_off active returns EWA_COOLING_OFF_ACTIVE', async () => {
    const module = await buildModule([
      { token: SELF_CONTROLS_READER, value: COOLING_OFF_SELF_CONTROLS },
    ]);
    const store = module.get(InMemoryEwaTransferStore);
    const seed = await store.insert({
      employeeAccountId: '00000000-0000-0000-0000-000000000001',
      payPeriodStart: new Date('2026-05-01T00:00:00Z'),
      payPeriodEnd: new Date('2026-05-31T23:59:59Z'),
      requestedAmount: 20,
      feeAmount: 1.95,
      feeSubsidised: false,
      netAmount: 18.05,
      transferSpeed: 'instant',
      bankAccountId: null,
      fcaDisclosureShown: true,
      fcaDisclosureAt: new Date(),
    });
    await store.setStatus({
      id: seed.id,
      status: 'completed',
      completedAt: new Date(),
    });
    const service = module.get(TransferService);

    await expect(service.executeTransfer(validInput)).rejects.toMatchObject({
      response: { code: 'EWA_COOLING_OFF_ACTIVE' },
    });
  });

  it('instant transfer fee is 1.95 when employer subsidy is false', async () => {
    const module = await buildModule();
    const service = module.get(TransferService);
    const transfer = await service.executeTransfer(validInput);

    expect(transfer.feeAmount).toBe(1.95);
    expect(transfer.feeSubsidised).toBe(false);
  });

  it('instant transfer fee is 0.00 when employer subsidy is true', async () => {
    const module = await buildModule([
      { token: HR_ADAPTER, value: SUBSIDISED_HR },
    ]);
    const service = module.get(TransferService);
    const transfer = await service.executeTransfer(validInput);

    expect(transfer.feeAmount).toBe(0);
    expect(transfer.feeSubsidised).toBe(true);
  });

  it('standard transfer fee is always 0.00', async () => {
    const module = await buildModule();
    const service = module.get(TransferService);
    const transfer = await service.executeTransfer({
      ...validInput,
      transferSpeed: 'standard',
    });

    expect(transfer.feeAmount).toBe(0);
  });

  it('net amount equals requested minus actual fee', async () => {
    const module = await buildModule();
    const service = module.get(TransferService);
    const transfer = await service.executeTransfer(validInput);

    expect(transfer.netAmount).toBe(48.05);
    expect(transfer.netAmount).toBe(
      Math.round((transfer.requestedAmount - transfer.feeAmount) * 100) / 100,
    );
  });

  it('payroll deduction queue record created on transfer completed', async () => {
    const module = await buildModule();
    const deductionQueue = module.get<InMemoryEwaDeductionQueueWriter>(
      EWA_DEDUCTION_QUEUE_WRITER,
    );
    const service = module.get(TransferService);
    const transfer = await service.executeTransfer(validInput);

    expect(deductionQueue.queued).toEqual([
      expect.objectContaining({
        ewaTransferId: transfer.id,
        amount: validInput.amount,
        fourthEmployeeId: validInput.fourthEmployeeId,
      }),
    ]);
  });

  it('audit log records fca_disclosure_shown and acknowledged', async () => {
    const module = await buildModule();
    const auditLog = module.get<InMemoryAuditLogWriter>(AUDIT_LOG_WRITER);
    const service = module.get(TransferService);
    await service.executeTransfer(validInput);
    const eventTypes = auditLog.events.map((e) => e.eventType);

    expect(eventTypes).toContain('fca_disclosure_shown');
    expect(eventTypes).toContain('fca_disclosure_acknowledged');
  });
});
