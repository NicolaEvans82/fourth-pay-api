import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './pg';
import type {
  NewSavingsPot,
  SavingsPot,
  SavingsPotReader,
  SavingsPotWriter,
} from './savings-pot.store';

@Injectable()
export class PgSavingsPotStore implements SavingsPotReader, SavingsPotWriter {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listByEmployee(employeeAccountId: string): Promise<SavingsPot[]> {
    const r = await this.pool.query<SavingsPotRow>(
      `SELECT * FROM savings_pots
        WHERE employee_account_id = $1
        ORDER BY created_at ASC`,
      [employeeAccountId],
    );
    return r.rows.map(fromRow);
  }

  async findById(id: string): Promise<SavingsPot | null> {
    const r = await this.pool.query<SavingsPotRow>(
      `SELECT * FROM savings_pots WHERE id = $1`,
      [id],
    );
    return r.rows[0] ? fromRow(r.rows[0]) : null;
  }

  async findDefault(employeeAccountId: string): Promise<SavingsPot | null> {
    const r = await this.pool.query<SavingsPotRow>(
      `SELECT * FROM savings_pots
        WHERE employee_account_id = $1 AND is_default = true`,
      [employeeAccountId],
    );
    return r.rows[0] ? fromRow(r.rows[0]) : null;
  }

  async insert(input: NewSavingsPot): Promise<SavingsPot> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // If caller asked for default, demote any existing default for
      // this employee so the unique index doesn't fire.
      if (input.isDefault) {
        await client.query(
          `UPDATE savings_pots SET is_default = false, updated_at = NOW()
            WHERE employee_account_id = $1 AND is_default = true`,
          [input.employeeAccountId],
        );
      }
      const existing = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM savings_pots
          WHERE employee_account_id = $1`,
        [input.employeeAccountId],
      );
      const isFirst = parseInt(existing.rows[0].count, 10) === 0;
      const r = await client.query<SavingsPotRow>(
        `INSERT INTO savings_pots (
           employee_account_id, name, target_amount, is_default
         ) VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          input.employeeAccountId,
          input.name,
          input.targetAmount,
          input.isDefault ?? isFirst,
        ],
      );
      await client.query('COMMIT');
      return fromRow(r.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async credit(input: { id: string; amount: number }): Promise<SavingsPot> {
    const r = await this.pool.query<SavingsPotRow>(
      `UPDATE savings_pots
          SET balance = balance + $2,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [input.id, input.amount],
    );
    if (!r.rows[0]) {
      throw new Error(`SavingsPot not found: ${input.id}`);
    }
    return fromRow(r.rows[0]);
  }
}

interface SavingsPotRow {
  id: string;
  employee_account_id: string;
  name: string;
  target_amount: string | null;
  balance: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

function fromRow(r: SavingsPotRow): SavingsPot {
  return {
    id: r.id,
    employeeAccountId: r.employee_account_id,
    name: r.name,
    targetAmount: r.target_amount === null ? null : parseFloat(r.target_amount),
    balance: parseFloat(r.balance),
    isDefault: r.is_default,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
