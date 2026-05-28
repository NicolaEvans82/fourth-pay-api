import { Injectable, Logger } from '@nestjs/common';
import { BalanceService, type EwaBalance } from '../ewa/balance.service';
import {
  EarningsService,
  type EarningsResponse,
} from '../ewa/earnings.service';
import { SelfControlsService } from '../self-controls/self-controls.service';
import type { SelfControlsRecord } from '../../database/readers/self-controls.reader';
import type { CoachHistoryTurn } from './dtos';

export interface CoachInput {
  fourthEmployeeId: string;
  fourthEmployerId: string;
  message: string;
  conversationHistory: CoachHistoryTurn[];
}

interface CoachContext {
  balance: EwaBalance | null;
  earnings: EarningsResponse | null;
  selfControls: SelfControlsRecord | null;
}

const PREFIX = 'This is guidance, not financial advice.';
const SUFFIX = 'Would you like to know more about any of these options?';

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    private readonly balanceService: BalanceService,
    private readonly earningsService: EarningsService,
    private readonly selfControlsService: SelfControlsService,
  ) {}

  async sendMessage(input: CoachInput): Promise<{ reply: string }> {
    const ctx = await this.gatherContext(input);
    const body = this.routeReply(input.message, ctx);
    return { reply: `${PREFIX}\n\n${body}\n\n${SUFFIX}` };
  }

  private async gatherContext(input: CoachInput): Promise<CoachContext> {
    const auth = {
      fourthEmployeeId: input.fourthEmployeeId,
      fourthEmployerId: input.fourthEmployerId,
    };
    const [balance, earnings, selfControls] = await Promise.all([
      this.balanceService.getBalance(auth).catch((err) => {
        this.logger.warn(`balance fetch failed: ${err}`);
        return null;
      }),
      this.earningsService.getEarnings(auth).catch((err) => {
        this.logger.warn(`earnings fetch failed: ${err}`);
        return null;
      }),
      this.selfControlsService
        .get({ ...auth, role: 'employee' })
        .catch((err) => {
          this.logger.warn(`self-controls fetch failed: ${err}`);
          return null;
        }),
    ]);
    return { balance, earnings, selfControls };
  }

  private routeReply(message: string, ctx: CoachContext): string {
    const m = message.toLowerCase();
    // Topical keywords (earn/save/limit/payday) win over the generic
    // "how much" balance branch so questions like "how much have I earned"
    // hit the earnings reply.
    if (/(earn|shift|work)/.test(m)) {
      return this.replyEarn(ctx);
    }
    if (/(save|saving|pot)/.test(m)) {
      return this.replySave(ctx);
    }
    if (/(limit|control)/.test(m)) {
      return this.replyLimit(ctx);
    }
    if (/(payday|pay day|when)/.test(m)) {
      return this.replyPayday(ctx);
    }
    if (/(access|available|how much)/.test(m)) {
      return this.replyAccess(ctx);
    }
    return this.replyDefault(ctx);
  }

  private replyAccess(ctx: CoachContext): string {
    const b = ctx.balance;
    if (!b) {
      return "I can't see your balance right now, but you can check it on the home screen. Tap 'Get paid now' to see what's available.";
    }
    return [
      `You've got ${gbp(b.availableAmount)} available to access right now, out of ${gbp(b.earnedAmount)} earned this period.`,
      `You've already accessed ${gbp(b.accessedAmount)} this month.`,
      `Standard transfers are free; instant transfers cost £1.95${b.employerSubsidy ? ' — but your employer covers that fee for you' : ''}.`,
    ].join(' ');
  }

  private replySave(ctx: CoachContext): string {
    const sc = ctx.selfControls;
    const b = ctx.balance;
    const lines: string[] = [
      "Auto-save is a brilliant way to build a buffer without thinking about it. It moves a percentage of every transfer straight into a savings pot.",
    ];
    if (sc) {
      if (sc.autoSaveEnabled) {
        lines.push(
          `Yours is already on at ${sc.autoSavePercent}% — so your next transfer automatically tops up your pot.`,
        );
      } else {
        const example =
          b && b.availableAmount > 0
            ? ` On your current ${gbp(b.availableAmount)} available, that'd save about ${gbp(Math.round(b.availableAmount * 0.1 * 100) / 100)} next time.`
            : '';
        lines.push(
          `It's currently off. Head to Self-controls to turn it on — even 10% adds up fast.${example}`,
        );
      }
    } else {
      lines.push('You can turn it on in Self-controls.');
    }
    return lines.join(' ');
  }

  private replyLimit(ctx: CoachContext): string {
    const sc = ctx.selfControls;
    const b = ctx.balance;
    if (sc && sc.monthlyLimitEnabled && sc.monthlyLimitAmount && b) {
      const used = b.accessedAmount;
      const cap = sc.monthlyLimitAmount;
      const remaining = Math.max(0, cap - used);
      const pct = Math.round((used / cap) * 100);
      return [
        `You've used ${gbp(used)} of your ${gbp(cap)} monthly limit (${pct}%), so ${gbp(remaining)} is still available before you hit the cap.`,
        'Your limits are yours to set — you can adjust them anytime in Self-controls. Lower caps help you stay in control; higher caps give more flexibility.',
      ].join(' ');
    }
    return 'Your monthly limit is off right now. Turning one on in Self-controls is a good way to stay in control of how often you dip into earned pay.';
  }

  private replyPayday(ctx: CoachContext): string {
    const b = ctx.balance;
    if (!b) {
      return "I can't see your pay schedule right now — check the home screen for your next payday.";
    }
    const days = Math.max(
      0,
      Math.ceil((b.nextPayday.getTime() - Date.now()) / 86400000),
    );
    return [
      `Your next payday is ${formatLongDate(b.nextPayday)} — ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} away`}.`,
      `That covers the pay period ${formatShortDate(b.payPeriodStart)} – ${formatShortDate(b.payPeriodEnd)}.`,
      `You've earned ${gbp(b.earnedAmount)} so far this period.`,
    ].join(' ');
  }

  private replyEarn(ctx: CoachContext): string {
    const e = ctx.earnings;
    const b = ctx.balance;
    if (!e) {
      return "I can't see your shifts right now — check the Earnings tracker for the full breakdown.";
    }
    const totalHours = e.shifts.reduce((s, sh) => s + sh.hours, 0);
    const elementCounts = new Map<string, { hours: number; value: number }>();
    for (const s of e.shifts) {
      const prev = elementCounts.get(s.elementName) ?? { hours: 0, value: 0 };
      prev.hours += s.hours;
      prev.value += s.value;
      elementCounts.set(s.elementName, prev);
    }
    const breakdown = Array.from(elementCounts.entries())
      .sort((a, b) => b[1].value - a[1].value)
      .map(([name, v]) => `${name} ${gbp(v.value)} (${v.hours.toFixed(1)}h)`)
      .join(', ');
    const lines = [
      `You've worked ${e.shifts.length} shift${e.shifts.length === 1 ? '' : 's'} totalling ${totalHours.toFixed(1)} hours this pay period, earning ${gbp(e.summary.grossEarned)} gross.`,
      `Breakdown: ${breakdown}.`,
    ];
    if (b) {
      lines.push(
        `Of that, ${gbp(b.availableAmount)} is available to access early right now.`,
      );
    }
    return lines.join(' ');
  }

  private replyDefault(ctx: CoachContext): string {
    const b = ctx.balance;
    if (b) {
      return [
        "Hi! I can see your finances in one place and I'm here to help.",
        `You've got ${gbp(b.availableAmount)} available right now, with your next payday on ${formatLongDate(b.nextPayday)}.`,
        'Ask me about your earnings, monthly limits, saving on every transfer, or when you next get paid — I can break any of it down for you.',
      ].join(' ');
    }
    return [
      'Hi! I can see your finances in one place and I am here to help.',
      'Ask me about your earnings, monthly limits, auto-save, or your next payday — I can break any of it down for you.',
    ].join(' ');
  }
}

function gbp(amount: number): string {
  return '£' + (Number.isInteger(amount) ? amount.toString() : amount.toFixed(2));
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
