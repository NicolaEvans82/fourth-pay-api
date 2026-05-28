import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { CoachMessageBody, type CoachMessageResponse } from './dtos';
import { CoachService } from './coach.service';

const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/coach')
export class CoachController {
  constructor(private readonly service: CoachService) {}

  @Post('message')
  async message(
    @Headers() headers: Record<string, string>,
    @Body() body: CoachMessageBody,
  ): Promise<CoachMessageResponse> {
    const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
    const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
    if (!fourthEmployeeId || !fourthEmployerId) {
      throw new BadRequestException(
        `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
      );
    }
    return this.service.sendMessage({
      fourthEmployeeId,
      fourthEmployerId,
      message: body.message,
      conversationHistory: body.conversationHistory,
    });
  }
}
