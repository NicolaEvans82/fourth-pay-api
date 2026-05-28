import {
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CoachHistoryTurn {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class CoachMessageBody {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoachHistoryTurn)
  conversationHistory!: CoachHistoryTurn[];
}

export interface CoachMessageResponse {
  reply: string;
}
