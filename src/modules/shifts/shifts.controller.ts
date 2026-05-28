import {
  BadRequestException,
  Controller,
  Get,
  Headers,
} from '@nestjs/common';
import type { ShiftsResponse } from './dtos';
import { ShiftsService } from './shifts.service';

const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/shifts')
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Get()
  async list(
    @Headers() headers: Record<string, string>,
  ): Promise<ShiftsResponse> {
    const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
    const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
    if (!fourthEmployeeId || !fourthEmployerId) {
      throw new BadRequestException(
        `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
      );
    }
    return this.service.getShifts({ fourthEmployeeId, fourthEmployerId });
  }
}
