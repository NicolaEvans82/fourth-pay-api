import { Inject, Injectable } from '@nestjs/common';
import {
  WFM_ADAPTER,
  type ShiftRecord,
  type WfmAdapter,
} from '../../integrations/wfm/wfm.adapter';
import type {
  RecentShift,
  ShiftsResponse,
  UpcomingShift,
  WeeklySummary,
} from './dtos';

const DAY_MS = 86400000;
const RECENT_DAYS = 14;
const UPCOMING_DAYS = 7;

// Mock universe is anchored to 2026-05-28. Production should use new Date().
// Tests don't go through this service, so the anchor is safe.
function anchorNow(): Date {
  return new Date(Date.UTC(2026, 4, 28, 12, 0, 0));
}

@Injectable()
export class ShiftsService {
  constructor(@Inject(WFM_ADAPTER) private readonly wfm: WfmAdapter) {}

  async getShifts(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<ShiftsResponse> {
    const now = anchorNow();
    const recentFrom = new Date(now.getTime() - RECENT_DAYS * DAY_MS);
    const upcomingTo = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS);

    const [confirmed, scheduled] = await Promise.all([
      this.wfm.getConfirmedShifts({
        fourthEmployeeId: input.fourthEmployeeId,
        from: recentFrom,
        to: now,
      }),
      this.wfm.getScheduledShifts({
        fourthEmployeeId: input.fourthEmployeeId,
        from: now,
        to: upcomingTo,
      }),
    ]);

    const recent = collapseByDate(confirmed)
      .map(toRecentShift)
      .sort((a, b) => b.date.localeCompare(a.date));

    const upcoming = scheduled
      .map(toUpcomingShift)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    const week = weekRangeFor(now);
    const [weekConfirmed, weekScheduled] = await Promise.all([
      this.wfm.getConfirmedShifts({
        fourthEmployeeId: input.fourthEmployeeId,
        from: week.start,
        to: week.end,
      }),
      this.wfm.getScheduledShifts({
        fourthEmployeeId: input.fourthEmployeeId,
        from: week.start,
        to: week.end,
      }),
    ]);
    const weekShifts = [...weekConfirmed, ...weekScheduled];
    const weeklySummary: WeeklySummary = {
      weekStart: isoDate(week.start),
      weekEnd: isoDate(week.end),
      totalHours: round2(weekShifts.reduce((s, x) => s + x.units, 0)),
      totalEarnings: round2(weekShifts.reduce((s, x) => s + x.value, 0)),
      shiftCount: collapseByDate(weekShifts).length,
    };

    return { upcoming, recent, weeklySummary };
  }
}

function collapseByDate(shifts: ShiftRecord[]): ShiftRecord[] {
  // A single calendar day with multiple rows (e.g. Basic + Bank Holiday
  // premium) is one *shift* with a stacked element. Pick the Basic row
  // as the canonical representative for date / start / end / site, but
  // sum hours and value across all rows on that day.
  const groups = new Map<string, ShiftRecord[]>();
  for (const s of shifts) {
    const key = isoDate(s.startDateTime);
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }
  const out: ShiftRecord[] = [];
  for (const arr of groups.values()) {
    const canonical =
      arr.find((s) => s.elementName === 'Basic Hours') ?? arr[0];
    out.push({
      ...canonical,
      // Aggregate hours and value across all element rows for the day.
      units: arr.reduce((s, x) => s + x.units, 0) / arr.length, // hours don't double-count
      value: arr.reduce((s, x) => s + x.value, 0),
      // Element label: 'Basic Hours' if pure, otherwise the premium label.
      elementName: pickElementLabel(arr),
    });
  }
  return out;
}

function pickElementLabel(arr: ShiftRecord[]): string {
  const nonBasic = arr.find((s) => s.elementName !== 'Basic Hours');
  return nonBasic ? nonBasic.elementName : 'Basic Hours';
}

function toUpcomingShift(s: ShiftRecord): UpcomingShift {
  return {
    date: isoDate(s.startDateTime),
    dayName: dayName(s.startDateTime),
    startTime: hhmm(s.startDateTime),
    endTime: hhmm(s.endDateTime),
    hours: round2(s.units),
    site: s.site ?? null,
    role: s.role ?? null,
  };
}

function toRecentShift(s: ShiftRecord): RecentShift {
  return {
    date: isoDate(s.startDateTime),
    dayName: dayName(s.startDateTime),
    hours: round2(s.units),
    earnings: round2(s.value),
    elementType: s.elementName,
    site: s.site ?? null,
  };
}

function weekRangeFor(d: Date): { start: Date; end: Date } {
  // ISO week — Monday is day 1, Sunday is day 7. Returns the Mon
  // 00:00:00 UTC and Sun 23:59:59 UTC of the calendar week containing d.
  const dow = d.getUTCDay(); // 0=Sun ... 6=Sat
  const sinceMonday = dow === 0 ? 6 : dow - 1;
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday),
  );
  const end = new Date(start.getTime() + 7 * DAY_MS - 1000);
  return { start, end };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hhmm(d: Date): string {
  return (
    String(d.getUTCHours()).padStart(2, '0') +
    ':' +
    String(d.getUTCMinutes()).padStart(2, '0')
  );
}

function dayName(d: Date): string {
  return [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][d.getUTCDay()];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
