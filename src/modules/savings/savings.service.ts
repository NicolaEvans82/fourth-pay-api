import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EMPLOYEE_ACCOUNT_READER,
  type EmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import {
  SAVINGS_POT_READER,
  SAVINGS_POT_WRITER,
  type SavingsPot,
  type SavingsPotReader,
  type SavingsPotWriter,
} from '../../database/savings-pot.store';
import type { PotJson } from './dtos';

@Injectable()
export class SavingsService {
  constructor(
    @Inject(EMPLOYEE_ACCOUNT_READER)
    private readonly employees: EmployeeAccountReader,
    @Inject(SAVINGS_POT_READER)
    private readonly reader: SavingsPotReader,
    @Inject(SAVINGS_POT_WRITER)
    private readonly writer: SavingsPotWriter,
  ) {}

  async listPots(fourthEmployeeId: string): Promise<PotJson[]> {
    const employee = await this.requireEmployee(fourthEmployeeId);
    const pots = await this.reader.listByEmployee(employee.id);
    return pots.map(toJson);
  }

  async createPot(
    fourthEmployeeId: string,
    input: { name: string; targetAmount?: number | null },
  ): Promise<PotJson> {
    const employee = await this.requireEmployee(fourthEmployeeId);
    const pot = await this.writer.insert({
      employeeAccountId: employee.id,
      name: input.name,
      targetAmount: input.targetAmount ?? null,
    });
    return toJson(pot);
  }

  async contribute(
    fourthEmployeeId: string,
    potId: string,
    amount: number,
  ): Promise<PotJson> {
    const employee = await this.requireEmployee(fourthEmployeeId);
    const pot = await this.reader.findById(potId);
    if (!pot || pot.employeeAccountId !== employee.id) {
      // Do not leak the existence of someone else's pot — same 404
      // shape whether the id is unknown or belongs to another user
      // (CLAUDE.md rule 5).
      throw new NotFoundException(`Pot not found: ${potId}`);
    }
    const updated = await this.writer.credit({ id: potId, amount });
    return toJson(updated);
  }

  private async requireEmployee(faid: string) {
    const employee = await this.employees.findByFourthEmployeeId(faid);
    if (!employee) {
      throw new NotFoundException(
        'Employee account not enrolled in Fourth Pay',
      );
    }
    return employee;
  }
}

function toJson(p: SavingsPot): PotJson {
  return {
    id: p.id,
    name: p.name,
    targetAmount: p.targetAmount,
    balance: p.balance,
    isDefault: p.isDefault,
    progressPercent:
      p.targetAmount && p.targetAmount > 0
        ? Math.round((p.balance / p.targetAmount) * 1000) / 10
        : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
