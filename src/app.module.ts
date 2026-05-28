import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoachModule } from './modules/coach/coach.module';
import { DemoModule } from './modules/demo/demo.module';
import { EmployerModule } from './modules/employer/employer.module';
import { EwaModule } from './modules/ewa/ewa.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PayslipModule } from './modules/payslip/payslip.module';
import { SelfControlsModule } from './modules/self-controls/self-controls.module';
import { ShiftsModule } from './modules/shifts/shifts.module';

@Module({
  imports: [
    EwaModule,
    SelfControlsModule,
    PayslipModule,
    NotificationsModule,
    CoachModule,
    EmployerModule,
    ShiftsModule,
    DemoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
