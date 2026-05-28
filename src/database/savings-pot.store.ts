import { Injectable, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JORDAN_ACCOUNT } from './readers/employee-account.reader';

export const SAVINGS_POT_READER = Symbol('SavingsPotReader');
export const SAVINGS_POT_WRITER = Symbol('SavingsPotWriter');

export interface SavingsPot {
  id: string;
  employeeAccountId: string;
  name: string;
  targetAmount: number | null;
  balance: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewSavingsPot {
  employeeAccountId: string;
  name: string;
  targetAmount: number | null;
  isDefault?: boolean;
}

export interface SavingsPotReader {
  listByEmployee(employeeAccountId: string): Promise<SavingsPot[]>;
  findById(id: string): Promise<SavingsPot | null>;
  findDefault(employeeAccountId: string): Promise<SavingsPot | null>;
}

export interface SavingsPotWriter {
  insert(input: NewSavingsPot): Promise<SavingsPot>;
  // Atomic credit — used by both manual `contribute` and the auto-save
  // sink. Returns the updated pot.
  credit(input: { id: string; amount: number }): Promise<SavingsPot>;
}

@Injectable()
export class InMemorySavingsPotStore
  implements SavingsPotReader, SavingsPotWriter, OnModuleInit
{
  private readonly pots: SavingsPot[] = [];

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    if (this.pots.length > 0) return;
    this.seedAll();
  }

  // Demo-only — wipes and re-seeds. Called by DemoController so the
  // /api/v1/demo/reset endpoint also resets the pot baseline.
  resetToSeed(): void {
    this.pots.length = 0;
    this.seedAll();
  }

  private seedAll(): void {
    // Jordan's Emergency fund — same id used in the Pg seed migration
    // (`20260528000004_seed_demo_employees`) so the demo persona has
    // identical state in both modes.
    this.pots.push({
      id: '22222222-2222-2222-2222-222222222222',
      employeeAccountId: JORDAN_ACCOUNT.id,
      name: 'Emergency fund',
      targetAmount: 500,
      balance: 45,
      isDefault: true,
      createdAt: new Date('2026-03-01T00:00:00Z'),
      updatedAt: new Date('2026-05-20T00:00:00Z'),
    });
  }

  async listByEmployee(employeeAccountId: string): Promise<SavingsPot[]> {
    return this.pots
      .filter((p) => p.employeeAccountId === employeeAccountId)
      .map((p) => ({ ...p }));
  }

  async findById(id: string): Promise<SavingsPot | null> {
    const found = this.pots.find((p) => p.id === id);
    return found ? { ...found } : null;
  }

  async findDefault(employeeAccountId: string): Promise<SavingsPot | null> {
    const found = this.pots.find(
      (p) => p.employeeAccountId === employeeAccountId && p.isDefault,
    );
    return found ? { ...found } : null;
  }

  async insert(input: NewSavingsPot): Promise<SavingsPot> {
    const now = new Date();
    // If marked default and another default exists, demote the other.
    if (input.isDefault) {
      for (const p of this.pots) {
        if (p.employeeAccountId === input.employeeAccountId) p.isDefault = false;
      }
    }
    // First pot is automatically default — auto-save needs a target.
    const isFirst = !this.pots.some(
      (p) => p.employeeAccountId === input.employeeAccountId,
    );
    const pot: SavingsPot = {
      id: randomUUID(),
      employeeAccountId: input.employeeAccountId,
      name: input.name,
      targetAmount: input.targetAmount,
      balance: 0,
      isDefault: input.isDefault ?? isFirst,
      createdAt: now,
      updatedAt: now,
    };
    this.pots.push(pot);
    return { ...pot };
  }

  async credit(input: { id: string; amount: number }): Promise<SavingsPot> {
    const pot = this.pots.find((p) => p.id === input.id);
    if (!pot) throw new Error(`SavingsPot not found: ${input.id}`);
    pot.balance = round2(pot.balance + input.amount);
    pot.updatedAt = new Date();
    return { ...pot };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
