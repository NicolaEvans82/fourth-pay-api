import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePotBody {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  targetAmount?: number | null;
}

export class ContributeBody {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export interface PotJson {
  id: string;
  name: string;
  targetAmount: number | null;
  balance: number;
  isDefault: boolean;
  progressPercent: number | null;
  aerRate: number;
  dailyInterestAccrued: number;
  projectedAnnualInterest: number;
  createdAt: string;
  updatedAt: string;
}

export interface PotListResponse {
  pots: PotJson[];
}
