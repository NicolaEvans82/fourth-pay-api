import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Optional,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import {
  DiscountsService,
  type DiscountsResponse,
} from './discounts.service';

const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/discounts')
export class DiscountsController {
  constructor(
    private readonly service: DiscountsService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get()
  async get(
    @Headers() headers: Record<string, string>,
  ): Promise<DiscountsResponse> {
    const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
    const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
    if (!fourthEmployeeId || !fourthEmployerId) {
      throw new BadRequestException(
        `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
      );
    }
    const result = await this.service.getDiscounts({
      fourthEmployeeId,
      fourthEmployerId,
    });
    this.iq360?.emit('discounts.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
      properties: {
        partner_count: result.categories.reduce(
          (sum, c) => sum + c.discounts.length,
          0,
        ),
        employer_perk_count: result.employerPerks.length,
      },
    });
    return result;
  }
}
