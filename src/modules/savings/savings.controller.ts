import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Post,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import {
  ContributeBody,
  CreatePotBody,
  type PotJson,
  type PotListResponse,
} from './dtos';
import { SavingsService } from './savings.service';

const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/savings')
export class SavingsController {
  constructor(
    private readonly service: SavingsService,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get('pots')
  async list(
    @Headers() headers: Record<string, string>,
  ): Promise<PotListResponse> {
    const { fourthEmployeeId, fourthEmployerId } = extractIds(headers);
    const pots = await this.service.listPots(fourthEmployeeId);
    const totalPotBalance = round2(
      pots.reduce((sum, p) => sum + p.balance, 0),
    );
    const projectedAnnualInterest = round2(
      pots.reduce((sum, p) => sum + p.projectedAnnualInterest, 0),
    );
    this.iq360?.emit('savings.pot.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
      properties: { pot_count: pots.length },
    });
    this.iq360?.emit('savings.interest.viewed', {
      employee_id: fourthEmployeeId,
      employer_id: fourthEmployerId,
      properties: {
        total_pot_balance: totalPotBalance,
        projected_annual_interest: projectedAnnualInterest,
      },
    });
    return { pots };
  }

  @Post('pots')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers() headers: Record<string, string>,
    @Body() body: CreatePotBody,
  ): Promise<PotJson> {
    const { fourthEmployeeId } = extractIds(headers);
    return this.service.createPot(fourthEmployeeId, {
      name: body.name,
      targetAmount: body.targetAmount ?? null,
    });
  }

  @Post('pots/:id/contribute')
  @HttpCode(HttpStatus.OK)
  async contribute(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() body: ContributeBody,
  ): Promise<PotJson> {
    const { fourthEmployeeId } = extractIds(headers);
    return this.service.contribute(fourthEmployeeId, id, body.amount);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function extractIds(headers: Record<string, string>): {
  fourthEmployeeId: string;
  fourthEmployerId: string;
} {
  const fourthEmployeeId = headers[HEADER_FOURTH_EMPLOYEE_ID];
  const fourthEmployerId = headers[HEADER_FOURTH_EMPLOYER_ID];
  if (!fourthEmployeeId || !fourthEmployerId) {
    throw new BadRequestException(
      `Missing required headers: ${HEADER_FOURTH_EMPLOYEE_ID}, ${HEADER_FOURTH_EMPLOYER_ID}`,
    );
  }
  return { fourthEmployeeId, fourthEmployerId };
}
