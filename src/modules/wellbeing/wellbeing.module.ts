import { Module } from '@nestjs/common';
import {
  EMPLOYEE_ACCOUNT_READER,
  MockEmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import { EwaModule } from '../ewa/ewa.module';
import { SavingsModule } from '../savings/savings.module';
import { SelfControlsModule } from '../self-controls/self-controls.module';
import { WellbeingController } from './wellbeing.controller';
import { WellbeingService } from './wellbeing.service';

@Module({
  imports: [EwaModule, SelfControlsModule, SavingsModule],
  controllers: [WellbeingController],
  providers: [
    WellbeingService,
    { provide: EMPLOYEE_ACCOUNT_READER, useClass: MockEmployeeAccountReader },
  ],
})
export class WellbeingModule {}
