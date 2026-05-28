import { Module } from '@nestjs/common';
import { HrModule } from '../../integrations/hr/hr.module';
import { DiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';

@Module({
  imports: [HrModule],
  controllers: [DiscountsController],
  providers: [DiscountsService],
})
export class DiscountsModule {}
