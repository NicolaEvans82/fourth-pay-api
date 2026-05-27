import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateSelfControlsBody {
  @IsOptional()
  @IsBoolean()
  monthlyLimitEnabled?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(50)
  monthlyLimitAmount?: number | null;

  @IsOptional()
  @IsBoolean()
  perTransferLimitEnabled?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  perTransferLimitAmount?: number | null;

  @IsOptional()
  @IsBoolean()
  coolingOffEnabled?: boolean;

  @IsOptional()
  @IsIn([24, 48, 168])
  coolingOffHours?: number;

  @IsOptional()
  @IsBoolean()
  autoSaveEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  autoSavePercent?: number;

  @IsOptional()
  @IsBoolean()
  wellbeingNudgesEnabled?: boolean;
}

export class PauseRequestBody {
  @IsInt()
  @IsIn([30])
  durationDays!: number;
}

export class OverrideRequestBody {
  @IsString()
  @IsIn(['cooling_off', 'monthly_limit', 'per_transfer_limit'])
  controlType!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}
