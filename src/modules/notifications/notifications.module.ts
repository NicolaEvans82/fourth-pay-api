import { Module } from '@nestjs/common';
import {
  InMemoryNotificationsStore,
  NOTIFICATIONS_STORE,
} from '../../database/notifications.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  MockEmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    InMemoryNotificationsStore,
    { provide: NOTIFICATIONS_STORE, useExisting: InMemoryNotificationsStore },
    { provide: EMPLOYEE_ACCOUNT_READER, useClass: MockEmployeeAccountReader },
  ],
  exports: [NotificationsService, InMemoryNotificationsStore],
})
export class NotificationsModule {}
