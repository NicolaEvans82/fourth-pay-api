import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoachModule } from './modules/coach/coach.module';
import { EwaModule } from './modules/ewa/ewa.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PayslipModule } from './modules/payslip/payslip.module';
import { SelfControlsModule } from './modules/self-controls/self-controls.module';

@Module({
  imports: [
    EwaModule,
    SelfControlsModule,
    PayslipModule,
    NotificationsModule,
    CoachModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
