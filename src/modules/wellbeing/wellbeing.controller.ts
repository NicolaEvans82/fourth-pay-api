import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Optional,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import {
  WellbeingService,
  type WellbeingResponse,
} from './wellbeing.service';

const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/wellbeing')
export class WellbeingController {
  constructor(
    private readonly service: WellbeingService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get('score')
  async score(
    @Headers() headers: Record<string, string>,
  ): Promise<WellbeingResponse> {
    const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
    const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
    if (!fourthEmployeeId || !fourthEmployerId) {
      throw new BadRequestException(
        `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
      );
    }
    const result = await this.service.getScore({
      fourthEmployeeId,
      fourthEmployerId,
    });
    this.iq360?.emit('wellbeing.score.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
      properties: { score: result.score, band: result.band },
    });
    return result;
  }
}
