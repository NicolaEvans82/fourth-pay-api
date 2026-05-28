import { Module } from '@nestjs/common';
import { EwaModule } from '../ewa/ewa.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SelfControlsModule } from '../self-controls/self-controls.module';
import { DemoController } from './demo.controller';

@Module({
  imports: [EwaModule, SelfControlsModule, NotificationsModule],
  controllers: [DemoController],
})
export class DemoModule {}
