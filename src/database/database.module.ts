import {
  type DynamicModule,
  Global,
  Logger,
  Module,
  type Provider,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL, createPgPool } from './pg';
import { usePg } from './use-pg';

const log = new Logger('DatabaseModule');

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    if (!usePg()) {
      if (
        process.env.NODE_ENV === 'production' &&
        !process.env.DATABASE_URL
      ) {
        log.warn(
          'NODE_ENV=production but DATABASE_URL is unset — staying on in-memory stores. Set DATABASE_URL to switch to Postgres.',
        );
      }
      return { module: DatabaseModule, providers: [], exports: [] };
    }

    const poolProvider: Provider = {
      provide: PG_POOL,
      useFactory: () => {
        log.log('DATABASE_URL set — wiring PG_POOL for production stores.');
        return createPgPool({ connectionString: process.env.DATABASE_URL! });
      },
    };

    return {
      module: DatabaseModule,
      providers: [poolProvider],
      exports: [PG_POOL],
    };
  }
}

// Re-export so DI consumers can type their @Inject(PG_POOL) safely.
export type { Pool };
