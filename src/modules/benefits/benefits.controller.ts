import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Optional,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import {
  BenefitsService,
  type BenefitsResponse,
} from './benefits.service';

const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/benefits')
export class BenefitsController {
  constructor(
    private readonly service: BenefitsService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get()
  async get(
    @Headers() headers: Record<string, string>,
  ): Promise<BenefitsResponse> {
    const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
    const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
    if (!fourthEmployeeId || !fourthEmployerId) {
      throw new BadRequestException(
        `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
      );
    }
    const result = await this.service.getBenefits({ fourthEmployeeId });
    this.iq360?.emit('benefits.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
      properties: {
        nmw_compliant: result.nmwCompliance.compliant,
        pension_auto_enrol_eligible: result.pension.autoEnrolEligible,
      },
    });
    return result;
  }
}
