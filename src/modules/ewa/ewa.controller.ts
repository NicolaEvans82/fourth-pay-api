import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  Post,
  Query,
} from '@nestjs/common';
import { Iq360Service } from '../../common/instrumentation/iq360.service';
import {
  EWA_TRANSFER_READER,
  type EwaTransferReader,
} from '../../database/ewa-transfer.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  type EmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import { BalanceService } from './balance.service';
import {
  type BalanceResponse,
  type TransferListResponse,
  type TransferRequestBody,
  type TransferResponse,
} from './dtos';
import { TransferService } from './transfer.service';

// TODO: replace with Fourth SSO JWT extraction. Doc 2 specifies the JWT
// contains fourth_employee_id + fourth_employer_id; until auth is wired the
// controller takes them via dev headers so the live API can be exercised.
const HEADER_FOURTH_EMPLOYEE_ID = 'x-fourth-employee-id';
const HEADER_FOURTH_EMPLOYER_ID = 'x-fourth-employer-id';

@Controller('api/v1/ewa')
export class EwaController {
  constructor(
    private readonly balanceService: BalanceService,
    private readonly transferService: TransferService,
    @Inject(EMPLOYEE_ACCOUNT_READER)
    private readonly employees: EmployeeAccountReader,
    @Inject(EWA_TRANSFER_READER)
    private readonly transfersReader: EwaTransferReader,
    @Optional() private readonly iq360?: Iq360Service,
  ) {}

  @Get('balance')
  async getBalance(
    @Headers() headers: Record<string, string>,
  ): Promise<BalanceResponse> {
    const ids = extractIds(headers);
    const balance = await this.balanceService.getBalance(ids);
    // The balance card surfaces the FCA disclosure copy alongside the
    // available amount, so 'shown' fires whenever balance is read.
    this.iq360?.emit('ewa.balance.viewed', {
      employee_id: ids.fourthEmployeeId,
      employer_id: ids.fourthEmployerId,
    });
    this.iq360?.emit('ewa.fca.disclosure_shown', {
      employee_id: ids.fourthEmployeeId,
      employer_id: ids.fourthEmployerId,
    });
    return {
      availableAmount: balance.availableAmount,
      earnedAmount: balance.earnedAmount,
      accessedAmount: balance.accessedAmount,
      payPeriodStart: balance.payPeriodStart.toISOString(),
      payPeriodEnd: balance.payPeriodEnd.toISOString(),
      nextPayday: balance.nextPayday.toISOString(),
      employerSubsidy: balance.employerSubsidy,
      monthlyLimitRemaining: balance.monthlyLimitRemaining,
    };
  }

  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  async postTransfer(
    @Headers() headers: Record<string, string>,
    @Body() body: TransferRequestBody,
  ): Promise<TransferResponse> {
    const ids = extractIds(headers);
    if (body.fcaDisclosureAcknowledged === true) {
      this.iq360?.emit('ewa.fca.disclosure_acknowledged', {
        employee_id: ids.fourthEmployeeId,
        employer_id: ids.fourthEmployerId,
      });
    }
    const transfer = await this.transferService.executeTransfer({
      ...ids,
      amount: body.amount,
      transferSpeed: body.transferSpeed,
      bankAccountId: body.bankAccountId ?? null,
      fcaDisclosureAcknowledged: body.fcaDisclosureAcknowledged === true,
    });
    return {
      transferId: transfer.id,
      status: transfer.status,
      feeAmount: transfer.feeAmount,
      netAmount: transfer.netAmount,
      estimatedArrival:
        transfer.transferSpeed === 'instant'
          ? 'immediate'
          : '1-3 working days',
      fcaReference: transfer.id,
    };
  }

  @Get('transfers')
  async listTransfers(
    @Headers() headers: Record<string, string>,
    @Query('limit') limitRaw?: string,
    @Query('pay_period_start') payPeriodStartRaw?: string,
  ): Promise<TransferListResponse> {
    const ids = extractIds(headers);
    const employee = await this.employees.findByFourthEmployeeId(
      ids.fourthEmployeeId,
    );
    if (!employee) {
      return { transfers: [], totalAccessedThisPeriod: 0 };
    }

    const limit = limitRaw ? Math.min(parseInt(limitRaw, 10) || 20, 100) : 20;
    const payPeriodStart = payPeriodStartRaw
      ? new Date(payPeriodStartRaw)
      : undefined;
    const transfers = await this.transfersReader.findRecentByEmployee({
      employeeAccountId: employee.id,
      limit,
      payPeriodStart,
    });

    let totalAccessedThisPeriod = 0;
    if (payPeriodStart) {
      totalAccessedThisPeriod =
        await this.transfersReader.sumAdvancesInPeriod({
          employeeAccountId: employee.id,
          payPeriodStart,
        });
    }

    this.iq360?.emit('ewa.transfers.list.viewed', {
      employee_id: ids.fourthEmployeeId,
      employer_id: ids.fourthEmployerId,
      properties: { result_count: transfers.length },
    });

    return {
      transfers: transfers.map((t) => ({
        id: t.id,
        amount: t.requestedAmount,
        feeAmount: t.feeAmount,
        netAmount: t.netAmount,
        transferSpeed: t.transferSpeed,
        status: t.status,
        initiatedAt: t.initiatedAt.toISOString(),
        completedAt: t.completedAt?.toISOString() ?? null,
      })),
      totalAccessedThisPeriod,
    };
  }
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
