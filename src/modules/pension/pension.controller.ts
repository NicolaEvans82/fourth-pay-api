import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Optional,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import {
  PensionService,
  type PensionResponse,
} from './pension.service';

const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/pension')
export class PensionController {
  constructor(
    private readonly service: PensionService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get()
  async get(
    @Headers() headers: Record<string, string>,
  ): Promise<PensionResponse> {
    const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
    const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
    if (!fourthEmployeeId || !fourthEmployerId) {
      throw new BadRequestException(
        `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
      );
    }
    const result = await this.service.getPension({
      fourthEmployeeId,
      fourthEmployerId,
    });
    this.iq360?.emit('pension.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
      properties: {
        auto_enrolment_status: result.autoEnrolmentStatus,
      },
    });
    return result;
  }
}
