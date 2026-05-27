import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export const NOTIFICATIONS_STORE = Symbol('NotificationsStore');

export type NotificationCategory =
  | 'pay'
  | 'savings'
  | 'payslip'
  | 'wellbeing'
  | 'pension'
  | 'bills'
  | 'system';

export type NotificationUrgency = 'normal' | 'warning' | 'urgent';

export interface Notification {
  id: string;
  employeeAccountId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  screenLink: string;
  urgency: NotificationUrgency;
  fcaRequired: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NewNotification {
  employeeAccountId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  screenLink: string;
  urgency: NotificationUrgency;
  fcaRequired?: boolean;
}

export interface NotificationPreferences {
  employeeAccountId: string;
  disabledCategories: NotificationCategory[];
}

export interface NotificationsStore {
  insert(input: NewNotification): Promise<Notification>;
  list(input: {
    employeeAccountId: string;
    category?: NotificationCategory;
  }): Promise<Notification[]>;
  markRead(input: {
    id: string;
    employeeAccountId: string;
  }): Promise<Notification | null>;
  markAllRead(input: { employeeAccountId: string }): Promise<number>;
  getPreferences(
    employeeAccountId: string,
  ): Promise<NotificationPreferences>;
  setPreferences(input: NotificationPreferences): Promise<void>;
}

@Injectable()
export class InMemoryNotificationsStore implements NotificationsStore {
  private readonly notifications: Notification[] = [];
  private readonly preferences = new Map<string, NotificationPreferences>();

  async insert(input: NewNotification): Promise<Notification> {
    const notification: Notification = {
      id: randomUUID(),
      employeeAccountId: input.employeeAccountId,
      category: input.category,
      title: input.title,
      body: input.body,
      screenLink: input.screenLink,
      urgency: input.urgency,
      fcaRequired: input.fcaRequired ?? false,
      readAt: null,
      createdAt: new Date(),
    };
    this.notifications.push(notification);
    return notification;
  }

  async list(input: {
    employeeAccountId: string;
    category?: NotificationCategory;
  }): Promise<Notification[]> {
    return this.notifications
      .filter((n) => n.employeeAccountId === input.employeeAccountId)
      .filter((n) => (input.category ? n.category === input.category : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async markRead(input: {
    id: string;
    employeeAccountId: string;
  }): Promise<Notification | null> {
    const notification = this.notifications.find(
      (n) => n.id === input.id && n.employeeAccountId === input.employeeAccountId,
    );
    if (!notification) return null;
    if (!notification.readAt) notification.readAt = new Date();
    return notification;
  }

  async markAllRead(input: {
    employeeAccountId: string;
  }): Promise<number> {
    let count = 0;
    for (const n of this.notifications) {
      if (n.employeeAccountId === input.employeeAccountId && !n.readAt) {
        n.readAt = new Date();
        count++;
      }
    }
    return count;
  }

  async getPreferences(
    employeeAccountId: string,
  ): Promise<NotificationPreferences> {
    return (
      this.preferences.get(employeeAccountId) ?? {
        employeeAccountId,
        disabledCategories: [],
      }
    );
  }

  async setPreferences(input: NotificationPreferences): Promise<void> {
    this.preferences.set(input.employeeAccountId, { ...input });
  }
}
