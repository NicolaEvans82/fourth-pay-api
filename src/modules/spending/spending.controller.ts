import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Optional,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import { SpendingService, type SpendingResponse } from './spending.service';

const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/spending')
export class SpendingController {
  constructor(
    private readonly service: SpendingService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get()
  async get(@Headers() headers: Record<string, string>): Promise<SpendingResponse> {
    const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
    const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
    if (!fourthEmployeeId || !fourthEmployerId) {
      throw new BadRequestException(
        `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
      );
    }
    const result = await this.service.getSpending({ fourthEmployeeId, fourthEmployerId });
    this.iq360?.emit('spending.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
      properties: {
        category_count: result.categories.length,
        has_open_banking: false,
      },
    });
    return result;
  }
}
