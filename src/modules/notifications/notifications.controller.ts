import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
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
  constructor(
    private readonly service: NotificationsService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get()
  async list(
    @Headers() headers: Record<string, string>,
    @Query('category') categoryRaw?: string,
  ): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const fourthEmployeeId = extractEmployeeId(headers);
    const category = parseCategory(categoryRaw);
    const result = await this.service.list({ fourthEmployeeId, category });
    this.iq360?.emit('notifications.list.viewed', {
      employee_id: fourthEmployeeId,
      properties: {
        result_count: result.notifications.length,
        unread_count: result.unreadCount,
        ...(category ? { category } : {}),
      },
    });
    return result;
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ): Promise<Notification> {
    const fourthEmployeeId = extractEmployeeId(headers);
    const result = await this.service.markRead({ fourthEmployeeId, id });
    this.iq360?.emit('notifications.read', {
      employee_id: fourthEmployeeId,
      properties: { notification_id: id, category: result.category },
    });
    return result;
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
