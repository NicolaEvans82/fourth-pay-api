import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NOTIFICATIONS_STORE,
  type NewNotification,
  type Notification,
  type NotificationCategory,
  type NotificationsStore,
} from '../../database/notifications.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  type EmployeeAccount,
  type EmployeeAccountReader,
} from '../../database/readers/employee-account.reader';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(EMPLOYEE_ACCOUNT_READER)
    private readonly employees: EmployeeAccountReader,
    @Inject(NOTIFICATIONS_STORE)
    private readonly store: NotificationsStore,
  ) {}

  // Create a notification. Returns null if the category is disabled by the
  // employee and the notification is NOT FCA-required. FCA-required ones
  // bypass preferences per spec 8 AC4.
  async create(input: NewNotification): Promise<Notification | null> {
    const prefs = await this.store.getPreferences(input.employeeAccountId);
    if (
      prefs.disabledCategories.includes(input.category) &&
      !input.fcaRequired
    ) {
      return null;
    }
    return this.store.insert(input);
  }

  async list(input: {
    fourthEmployeeId: string;
    category?: NotificationCategory;
  }): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const employee = await this.findEmployee(input.fourthEmployeeId);
    const notifications = await this.store.list({
      employeeAccountId: employee.id,
      category: input.category,
    });
    const unreadCount = notifications.filter((n) => !n.readAt).length;
    return { notifications, unreadCount };
  }

  async markRead(input: {
    fourthEmployeeId: string;
    id: string;
  }): Promise<Notification> {
    const employee = await this.findEmployee(input.fourthEmployeeId);
    const notification = await this.store.markRead({
      id: input.id,
      employeeAccountId: employee.id,
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification;
  }

  async markAllRead(input: {
    fourthEmployeeId: string;
  }): Promise<{ updatedCount: number }> {
    const employee = await this.findEmployee(input.fourthEmployeeId);
    const updatedCount = await this.store.markAllRead({
      employeeAccountId: employee.id,
    });
    return { updatedCount };
  }

  async setPreferences(input: {
    fourthEmployeeId: string;
    disabledCategories: NotificationCategory[];
  }): Promise<void> {
    const employee = await this.findEmployee(input.fourthEmployeeId);
    await this.store.setPreferences({
      employeeAccountId: employee.id,
      disabledCategories: input.disabledCategories,
    });
  }

  private async findEmployee(faid: string): Promise<EmployeeAccount> {
    const employee = await this.employees.findByFourthEmployeeId(faid);
    if (!employee) {
      throw new NotFoundException(
        'Employee account not enrolled in Fourth Pay',
      );
    }
    return employee;
  }
}
