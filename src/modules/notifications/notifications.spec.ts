import { Test, type TestingModule } from '@nestjs/testing';
import {
  InMemoryNotificationsStore,
  NOTIFICATIONS_STORE,
} from '../../database/notifications.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  MockEmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import { JORDAN_HARRIS_FAID } from '../../integrations/wfm/wfm.mock';
import { NotificationsService } from './notifications.service';

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      NotificationsService,
      InMemoryNotificationsStore,
      { provide: NOTIFICATIONS_STORE, useExisting: InMemoryNotificationsStore },
      {
        provide: EMPLOYEE_ACCOUNT_READER,
        useClass: MockEmployeeAccountReader,
      },
    ],
  }).compile();
}

const JORDAN_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

describe('notifications (Spec 8) — acceptance criteria', () => {
  it('unread count in bell icon matches actual unread count', async () => {
    const module = await buildModule();
    const service = module.get(NotificationsService);

    const a = await service.create({
      employeeAccountId: JORDAN_ACCOUNT_ID,
      category: 'pay',
      title: 'Transfer confirmed',
      body: 'Your £50 transfer is on its way.',
      screenLink: '/ewa/transfers',
      urgency: 'normal',
    });
    await service.create({
      employeeAccountId: JORDAN_ACCOUNT_ID,
      category: 'wellbeing',
      title: '80% of monthly limit used',
      body: 'You have used 80% of your monthly EWA limit.',
      screenLink: '/self-controls',
      urgency: 'warning',
      fcaRequired: true,
    });
    await service.create({
      employeeAccountId: JORDAN_ACCOUNT_ID,
      category: 'pay',
      title: 'Transfer confirmed',
      body: 'Your £20 transfer is on its way.',
      screenLink: '/ewa/transfers',
      urgency: 'normal',
    });

    await service.markRead({
      fourthEmployeeId: JORDAN_HARRIS_FAID,
      id: a!.id,
    });

    const result = await service.list({
      fourthEmployeeId: JORDAN_HARRIS_FAID,
    });
    expect(result.notifications).toHaveLength(3);
    expect(result.unreadCount).toBe(2);
  });

  it('category filter returns only matching notifications', async () => {
    const module = await buildModule();
    const service = module.get(NotificationsService);

    await service.create({
      employeeAccountId: JORDAN_ACCOUNT_ID,
      category: 'pay',
      title: 'A',
      body: '',
      screenLink: '/ewa',
      urgency: 'normal',
    });
    await service.create({
      employeeAccountId: JORDAN_ACCOUNT_ID,
      category: 'pay',
      title: 'B',
      body: '',
      screenLink: '/ewa',
      urgency: 'normal',
    });
    await service.create({
      employeeAccountId: JORDAN_ACCOUNT_ID,
      category: 'savings',
      title: 'C',
      body: '',
      screenLink: '/savings',
      urgency: 'normal',
    });

    const result = await service.list({
      fourthEmployeeId: JORDAN_HARRIS_FAID,
      category: 'pay',
    });
    expect(result.notifications).toHaveLength(2);
    expect(result.notifications.every((n) => n.category === 'pay')).toBe(true);
  });

  it('mark all read sets all to read for employee', async () => {
    const module = await buildModule();
    const service = module.get(NotificationsService);

    for (let i = 0; i < 3; i++) {
      await service.create({
        employeeAccountId: JORDAN_ACCOUNT_ID,
        category: 'pay',
        title: `N${i}`,
        body: '',
        screenLink: '/ewa',
        urgency: 'normal',
      });
    }
    const before = await service.list({ fourthEmployeeId: JORDAN_HARRIS_FAID });
    expect(before.unreadCount).toBe(3);

    const result = await service.markAllRead({
      fourthEmployeeId: JORDAN_HARRIS_FAID,
    });
    expect(result.updatedCount).toBe(3);

    const after = await service.list({ fourthEmployeeId: JORDAN_HARRIS_FAID });
    expect(after.unreadCount).toBe(0);
    expect(after.notifications.every((n) => n.readAt !== null)).toBe(true);
  });

  it('fca_required notifications cannot be disabled', async () => {
    const module = await buildModule();
    const service = module.get(NotificationsService);

    await service.setPreferences({
      fourthEmployeeId: JORDAN_HARRIS_FAID,
      disabledCategories: ['wellbeing'],
    });

    const optional = await service.create({
      employeeAccountId: JORDAN_ACCOUNT_ID,
      category: 'wellbeing',
      title: 'Optional wellbeing tip',
      body: '',
      screenLink: '/wellbeing',
      urgency: 'normal',
      fcaRequired: false,
    });
    const fcaRequired = await service.create({
      employeeAccountId: JORDAN_ACCOUNT_ID,
      category: 'wellbeing',
      title: '80% of monthly limit used',
      body: '',
      screenLink: '/self-controls',
      urgency: 'warning',
      fcaRequired: true,
    });

    expect(optional).toBeNull(); // suppressed by preference
    expect(fcaRequired).not.toBeNull(); // delivered despite preference

    const list = await service.list({ fourthEmployeeId: JORDAN_HARRIS_FAID });
    expect(list.notifications).toHaveLength(1);
    expect(list.notifications[0].fcaRequired).toBe(true);
  });

  it('notification links to correct screen on tap', async () => {
    const module = await buildModule();
    const service = module.get(NotificationsService);

    await service.create({
      employeeAccountId: JORDAN_ACCOUNT_ID,
      category: 'pay',
      title: 'Transfer confirmed',
      body: 'Your £50 transfer is on its way.',
      screenLink: '/ewa/transfers',
      urgency: 'normal',
    });

    const result = await service.list({ fourthEmployeeId: JORDAN_HARRIS_FAID });
    expect(result.notifications[0].screenLink).toBe('/ewa/transfers');
  });
});
