import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Optional,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import { BudgetService, type BudgetResponse } from './budget.service';

const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/budget')
export class BudgetController {
  constructor(
    private readonly service: BudgetService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get()
  async get(
    @Headers() headers: Record<string, string>,
  ): Promise<BudgetResponse> {
    const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
    const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
    if (!fourthEmployeeId || !fourthEmployerId) {
      throw new BadRequestException(
        `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
      );
    }
    const budget = await this.service.getBudget({
      fourthEmployeeId,
      fourthEmployerId,
    });
    this.iq360?.emit('budget.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
    });
    return budget;
  }
}
