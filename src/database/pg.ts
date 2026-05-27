import { Pool, PoolConfig } from 'pg';

export const PG_POOL = Symbol('PgPool');

export interface DatabaseConfig {
  connectionString: string;
  max?: number;
}

export function createPgPool(config: DatabaseConfig): Pool {
  const poolConfig: PoolConfig = {
    connectionString: config.connectionString,
    max: config.max ?? 10,
  };
  return new Pool(poolConfig);
}
