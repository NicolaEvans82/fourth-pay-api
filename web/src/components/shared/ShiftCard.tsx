import { fmtGbp, fmtHHMM } from '../../format';
import type { EarningsShift, RecentShift, UpcomingShift } from '../../types/api';
import { shiftDayAbbr, shiftDayNum } from '../../format';

interface BaseProps {
  day: string;
  dayNum: number;
  name: string;
  meta: string;
  right: React.ReactNode;
}

function BaseShift({ day, dayNum, name, meta, right }: BaseProps) {
  return (
    <div className="shift-item">
      <div className="shift-left">
        <div className="shift-dot">
          <div className="shift-day">{day}</div>
          <div className="shift-num">{dayNum}</div>
        </div>
        <div>
          <div className="shift-name">{name}</div>
          <div className="shift-hrs">{meta}</div>
        </div>
      </div>
      <div className="shift-earn">{right}</div>
    </div>
  );
}

// Earnings-tracker variant: shift has full datetimes + a £ value.
export function EarningsShiftCard({ shift }: { shift: EarningsShift }) {
  const start = new Date(shift.startDateTime);
  const day = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][start.getUTCDay()];
  return (
    <BaseShift
      day={day}
      dayNum={start.getUTCDate()}
      name={shift.elementName}
      meta={`${fmtHHMM(shift.startDateTime)}–${fmtHHMM(shift.endDateTime)} · ${shift.hours}h`}
      right={fmtGbp(shift.value)}
    />
  );
}

export function UpcomingShiftCard({ shift }: { shift: UpcomingShift }) {
  const subline = (shift.role ?? 'Shift') + (shift.site ? ' · ' + shift.site : '');
  return (
    <BaseShift
      day={shiftDayAbbr(shift.date)}
      dayNum={shiftDayNum(shift.date)}
      name={subline}
      meta={`${shift.startTime}–${shift.endTime} · ${shift.hours}h`}
      right={
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--teal-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
          }}
        >
          Scheduled
        </span>
      }
    />
  );
}

export function RecentShiftCard({ shift }: { shift: RecentShift }) {
  const subline =
    (shift.elementType === 'Basic Hours' ? 'Basic Hours' : shift.elementType ?? 'Shift') +
    (shift.site ? ' · ' + shift.site : '');
  return (
    <BaseShift
      day={shiftDayAbbr(shift.date)}
      dayNum={shiftDayNum(shift.date)}
      name={subline}
      meta={`${shift.hours}h worked`}
      right={fmtGbp(shift.earnings)}
    />
  );
}
