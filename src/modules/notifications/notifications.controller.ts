import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type {
  Notification,
  NotificationCategory,
} from '../../database/notifications.store';
import { NotificationsService } from './notifications.service';

const VALID_CATEGORIES: NotificationCategory[] = [
  'pay',
  'savings',
  'payslip',
  'wellbeing',
  'pension',
  'bills',
  'system',
];

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  async list(
    @Headers() headers: Record<string, string>,
    @Query('category') categoryRaw?: string,
  ): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const fourthEmployeeId = extractEmployeeId(headers);
    const category = parseCategory(categoryRaw);
    return this.service.list({ fourthEmployeeId, category });
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ): Promise<Notification> {
    const fourthEmployeeId = extractEmployeeId(headers);
    return this.service.markRead({ fourthEmployeeId, id });
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllRead(
    @Headers() headers: Record<string, string>,
  ): Promise<{ updatedCount: number }> {
    const fourthEmployeeId = extractEmployeeId(headers);
    return this.service.markAllRead({ fourthEmployeeId });
  }
}

function extractEmployeeId(headers: Record<string, string>): string {
  const fourthEmployeeId = headers['x-fourth-employee-id'];
  if (!fourthEmployeeId) {
    throw new BadRequestException(
      'Missing required header: x-fourth-employee-id',
    );
  }
  return fourthEmployeeId;
}

function parseCategory(raw?: string): NotificationCategory | undefined {
  if (!raw) return undefined;
  if (!VALID_CATEGORIES.includes(raw as NotificationCategory)) {
    throw new BadRequestException(
      `Invalid category: ${raw}. Expected one of ${VALID_CATEGORIES.join(', ')}.`,
    );
  }
  return raw as NotificationCategory;
}
