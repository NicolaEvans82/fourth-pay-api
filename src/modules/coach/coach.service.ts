import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { BalanceService } from '../ewa/balance.service';
import { EarningsService } from '../ewa/earnings.service';
import { SelfControlsService } from '../self-controls/self-controls.service';
import type { CoachHistoryTurn } from './dtos';

export interface CoachInput {
  fourthEmployeeId: string;
  fourthEmployerId: string;
  message: string;
  conversationHistory: CoachHistoryTurn[];
}

// Spec 11 originally specified `claude-sonnet-4-20250514` (Sonnet 4.0,
// retires 2026-06-15). Bumped to Sonnet 4.6 — its launch replacement.
const COACH_MODEL = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 1024;
const MAX_HISTORY_TURNS = 20;

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);
  private readonly anthropic: Anthropic | null;

  constructor(
    private readonly balanceService: BalanceService,
    private readonly earningsService: EarningsService,
    private readonly selfControlsService: SelfControlsService,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
    if (!apiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — /api/v1/coach/message will return 503.',
      );
    }
  }

  async sendMessage(input: CoachInput): Promise<{ reply: string }> {
    if (!this.anthropic) {
      throw new ServiceUnavailableException(
        'Coach is not configured — ANTHROPIC_API_KEY is missing on the server.',
      );
    }

    const systemPrompt = await this.buildSystemPrompt(input);
    const history = input.conversationHistory
      .slice(-MAX_HISTORY_TURNS)
      .map((t) => ({ role: t.role, content: t.content }));

    try {
      const response = await this.anthropic.messages.create({
        model: COACH_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: systemPrompt,
        // Chat workload: keep latency low. Sonnet 4.6 defaults to
        // effort: high which is too slow for the Spec 11 5-second target.
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        messages: [...history, { role: 'user', content: input.message }],
      });

      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      if (!reply) {
        throw new InternalServerErrorException('Coach returned an empty reply.');
      }

      return { reply };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        this.logger.error(
          `Anthropic API error ${err.status}: ${err.message}`,
          err.stack,
        );
        throw new ServiceUnavailableException(
          'Coach is temporarily unavailable. Please try again.',
        );
      }
      throw err;
    }
  }

  private async buildSystemPrompt(input: CoachInput): Promise<string> {
    const auth = {
      fourthEmployeeId: input.fourthEmployeeId,
      fourthEmployerId: input.fourthEmployerId,
    };

    // Pull only Spec 11-permitted fields. Sort codes, account numbers, NI
    // numbers, and tax codes are deliberately excluded — they are never
    // sent to the LLM (CLAUDE.md rule 4, Spec 11 data_never_provided).
    const [balance, earnings, selfControls] = await Promise.all([
      this.balanceService.getBalance(auth).catch(() => null),
      this.earningsService.getEarnings(auth).catch(() => null),
      this.selfControlsService
        .get({ ...auth, role: 'employee' })
        .catch(() => null),
    ]);

    const lines: string[] = [
      'You are Jordan Harris\'s personal money coach inside the Fourth Pay app.',
      'Fourth Pay is an FCA-regulated Earned Wage Access product for hospitality workers.',
      '',
      '## Hard rules (must follow on every turn)',
      '- You are NOT a financial advisor. You provide guidance and education only. If asked whether you are a financial advisor, say no.',
      '- When discussing any financial product, preface with "This is not financial advice".',
      '- Never recommend specific external financial products by name (e.g. specific banks, ISAs, credit cards, investment funds, loan providers). Talk in general categories instead.',
      '- For complex situations (debt collections, bereavement, eviction risk, suspected fraud, serious mental health concerns), signpost to human support: the in-app "Talk to a money coach" route, StepChange, Citizens Advice, or Samaritans.',
      '- Reference Jordan\'s actual data below where helpful to personalise advice.',
      '- Stay concise — aim for under 150 words unless the question demands more.',
      '- Be warm and supportive. Hospitality work has volatile pay; respect that.',
      '',
      '## Jordan\'s financial snapshot (current as of this turn)',
    ];

    if (balance) {
      lines.push(
        `- Pay period: ${formatDate(balance.payPeriodStart)} – ${formatDate(balance.payPeriodEnd)}, paid ${formatDate(balance.nextPayday)}`,
        `- Earned so far this period: £${balance.earnedAmount.toFixed(2)}`,
        `- Accessed via Fourth Pay so far: £${balance.accessedAmount.toFixed(2)}`,
        `- Available to access right now: £${balance.availableAmount.toFixed(2)}`,
        `- Employer covers the instant transfer fee: ${balance.employerSubsidy ? 'yes' : 'no'}`,
      );
      if (balance.monthlyLimitRemaining !== null) {
        lines.push(
          `- Monthly self-imposed limit remaining: £${balance.monthlyLimitRemaining.toFixed(2)}`,
        );
      }
    } else {
      lines.push('- (Balance data unavailable this turn)');
    }

    if (earnings) {
      const totalHours = earnings.shifts.reduce((s, sh) => s + sh.hours, 0);
      lines.push(
        `- Shifts worked this period: ${earnings.shifts.length} (${totalHours.toFixed(1)} hours total)`,
      );
    }

    if (selfControls) {
      lines.push(
        '',
        '## Jordan\'s self-imposed access controls',
        `- Monthly cap: ${selfControls.monthlyLimitEnabled ? `£${selfControls.monthlyLimitAmount ?? 0}` : 'off'}`,
        `- Per-transfer cap: ${selfControls.perTransferLimitEnabled ? `£${selfControls.perTransferLimitAmount ?? 0}` : 'off'}`,
        `- Cooling-off between transfers: ${selfControls.coolingOffEnabled ? `${selfControls.coolingOffHours}h` : 'off'}`,
        `- Auto-save on access: ${selfControls.autoSaveEnabled ? `${selfControls.autoSavePercent}% of every transfer` : 'off'}`,
        `- Wellbeing nudges: ${selfControls.wellbeingNudgesEnabled ? 'on' : 'off'}`,
      );
    }

    return lines.join('\n');
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
