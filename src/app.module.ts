import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InstrumentationModule } from './common/instrumentation/instrumentation.module';
import { DatabaseModule } from './database/database.module';
import { usePg } from './database/use-pg';
import { BenefitsModule } from './modules/benefits/benefits.module';
import { BudgetModule } from './modules/budget/budget.module';
import { CoachModule } from './modules/coach/coach.module';
import { DemoModule } from './modules/demo/demo.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { EmployerModule } from './modules/employer/employer.module';
import { EwaModule } from './modules/ewa/ewa.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PayslipModule } from './modules/payslip/payslip.module';
import { PensionModule } from './modules/pension/pension.module';
import { SavingsModule } from './modules/savings/savings.module';
import { SelfControlsModule } from './modules/self-controls/self-controls.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { WellbeingModule } from './modules/wellbeing/wellbeing.module';

// Demo reset only makes sense for the in-memory stores; the Pg
// equivalents are stateful in the database and shouldn't be wiped via
// an unauth'd HTTP endpoint. Drop the module entirely in Pg mode so
// no /api/v1/demo/* route is exposed.
const baseModules = [
  EwaModule,
  SelfControlsModule,
  PayslipModule,
  NotificationsModule,
  CoachModule,
  EmployerModule,
  ShiftsModule,
  SavingsModule,
  BudgetModule,
  WellbeingModule,
  BenefitsModule,
  DiscountsModule,
  PensionModule,
];

const featureModules = usePg() ? baseModules : [...baseModules, DemoModule];

@Module({
  imports: [InstrumentationModule, DatabaseModule.forRoot(), ...featureModules],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
