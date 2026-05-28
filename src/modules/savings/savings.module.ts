import { Module, type Provider } from '@nestjs/common';
import {
  InMemorySavingsPotStore,
  SAVINGS_POT_READER,
  SAVINGS_POT_WRITER,
} from '../../database/savings-pot.store';
import { PgSavingsPotStore } from '../../database/pg-savings-pot.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  MockEmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import { usePg } from '../../database/use-pg';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';

const pgProviders: Provider[] = [
  PgSavingsPotStore,
  { provide: SAVINGS_POT_READER, useExisting: PgSavingsPotStore },
  { provide: SAVINGS_POT_WRITER, useExisting: PgSavingsPotStore },
];

const inMemoryProviders: Provider[] = [
  InMemorySavingsPotStore,
  { provide: SAVINGS_POT_READER, useExisting: InMemorySavingsPotStore },
  { provide: SAVINGS_POT_WRITER, useExisting: InMemorySavingsPotStore },
];

const storeProviders = usePg() ? pgProviders : inMemoryProviders;

@Module({
  controllers: [SavingsController],
  providers: [
    SavingsService,
    ...storeProviders,
    { provide: EMPLOYEE_ACCOUNT_READER, useClass: MockEmployeeAccountReader },
  ],
  exports: [
    SavingsService,
    SAVINGS_POT_READER,
    SAVINGS_POT_WRITER,
    ...(usePg() ? [] : [InMemorySavingsPotStore]),
  ],
})
export class SavingsModule {}
