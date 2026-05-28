import { Module } from '@nestjs/common';
import { WfmModule } from '../../integrations/wfm/wfm.module';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [WfmModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
})
export class ShiftsModule {}
