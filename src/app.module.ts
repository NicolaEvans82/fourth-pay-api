import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { usePg } from './database/use-pg';
import { CoachModule } from './modules/coach/coach.module';
import { DemoModule } from './modules/demo/demo.module';
import { EmployerModule } from './modules/employer/employer.module';
import { EwaModule } from './modules/ewa/ewa.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PayslipModule } from './modules/payslip/payslip.module';
import { SelfControlsModule } from './modules/self-controls/self-controls.module';
import { ShiftsModule } from './modules/shifts/shifts.module';

// Demo reset only makes sense for the in-memory stores; the Pg
// equivalents are stateful in the database and shouldn't be wiped via
// an unauth'd HTTP endpoint. Drop the module entirely in Pg mode so
// no /api/v1/demo/* route is exposed.
const featureModules = usePg()
  ? [
      EwaModule,
      SelfControlsModule,
      PayslipModule,
      NotificationsModule,
      CoachModule,
      EmployerModule,
      ShiftsModule,
    ]
  : [
      EwaModule,
      SelfControlsModule,
      PayslipModule,
      NotificationsModule,
      CoachModule,
      EmployerModule,
      ShiftsModule,
      DemoModule,
    ];

@Module({
  imports: [DatabaseModule.forRoot(), ...featureModules],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
