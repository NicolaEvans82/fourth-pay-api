import { Module, type Provider } from '@nestjs/common';
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

const devProviders: Provider[] =
  process.env.NODE_ENV === 'production'
    ? []
    : [
        InMemoryNotificationsStore,
        {
          provide: NOTIFICATIONS_STORE,
          useExisting: InMemoryNotificationsStore,
        },
        {
          provide: EMPLOYEE_ACCOUNT_READER,
          useClass: MockEmployeeAccountReader,
        },
      ];

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ...devProviders],
  exports: [NotificationsService],
})
export class NotificationsModule {}
