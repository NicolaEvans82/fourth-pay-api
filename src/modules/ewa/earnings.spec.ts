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
import {
  AUTO_SAVE_SINK,
  InMemoryAutoSaveSink,
} from '../savings/auto-save.sink';
import { BalanceService } from './balance.service';
import { EarningsService } from './earnings.service';
import { TransferService } from './transfer.service';

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      BalanceService,
      EarningsService,
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

const ctx = {
  fourthEmployeeId: JORDAN_HARRIS_FAID,
  fourthEmployerId: CROWN_PUB_GROUP_EMPLOYER_ID,
};

describe('earnings_tracker (Spec 3) — acceptance criteria', () => {
  it('response contains only confirmed shifts', async () => {
    const module = await buildModule();
    const service = module.get(EarningsService);
    const response = await service.getEarnings(ctx);
    // Jordan's fixture: 10 approved-hours rows for May 2026.
    expect(response.shifts).toHaveLength(10);
  });

  it('shift earnings match hours times rate', async () => {
    const module = await buildModule();
    const service = module.get(EarningsService);
    const response = await service.getEarnings(ctx);
    for (const shift of response.shifts) {
      expect(shift.value).toBeCloseTo(shift.hours * shift.rate, 2);
    }
  });

  it('period summary available_amount matches balance endpoint', async () => {
    const module = await buildModule();
    const earningsService = module.get(EarningsService);
    const balanceService = module.get(BalanceService);
    const [earnings, balance] = await Promise.all([
      earningsService.getEarnings(ctx),
      balanceService.getBalance(ctx),
    ]);
    expect(earnings.summary.availableAmount).toBe(balance.availableAmount);
    expect(earnings.summary.accessedAmount).toBe(balance.accessedAmount);
  });

  it('unconfirmed scheduled shifts are not included', async () => {
    const module = await buildModule();
    const service = module.get(EarningsService);
    const response = await service.getEarnings(ctx);
    // All returned shifts must come from approved-hours element names.
    const confirmedElements = new Set([
      'Basic Hours',
      'Bank Holiday',
      'Overtime',
    ]);
    for (const shift of response.shifts) {
      expect(confirmedElements.has(shift.elementName)).toBe(true);
    }
  });

  it('previous period accessible via query param', async () => {
    const module = await buildModule();
    const service = module.get(EarningsService);
    const aprilStart = new Date('2026-04-01T00:00:00Z');
    const response = await service.getEarnings({
      ...ctx,
      payPeriodStart: aprilStart,
    });
    expect(response.payPeriodStart.toISOString()).toBe(
      aprilStart.toISOString(),
    );
    expect(response.shifts).toHaveLength(0); // No fixture shifts in April.
    expect(response.summary.availableAmount).toBeNull();
  });
});
