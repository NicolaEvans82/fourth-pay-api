import { Module, type Provider } from '@nestjs/common';
import {
  InMemoryNotificationsStore,
  NOTIFICATIONS_STORE,
} from '../../database/notifications.store';
import { PgNotificationsStore } from '../../database/pg-notifications.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  MockEmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import { usePg } from '../../database/use-pg';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const pgProviders: Provider[] = [
  PgNotificationsStore,
  { provide: NOTIFICATIONS_STORE, useExisting: PgNotificationsStore },
];

const inMemoryProviders: Provider[] = [
  InMemoryNotificationsStore,
  { provide: NOTIFICATIONS_STORE, useExisting: InMemoryNotificationsStore },
];

const storeProviders = usePg() ? pgProviders : inMemoryProviders;

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ...storeProviders,
    { provide: EMPLOYEE_ACCOUNT_READER, useClass: MockEmployeeAccountReader },
  ],
  exports: [
    NotificationsService,
    ...(usePg() ? [] : [InMemoryNotificationsStore]),
  ],
})
export class NotificationsModule {}
