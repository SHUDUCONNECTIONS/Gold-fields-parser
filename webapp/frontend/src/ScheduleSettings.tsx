const HOURS_OPTIONS = [10, 9, 8];

const DAYS: { abbr: string; label: string }[] = [
  { abbr: "mon", label: "Mon" },
  { abbr: "tue", label: "Tue" },
  { abbr: "wed", label: "Wed" },
  { abbr: "thu", label: "Thu" },
  { abbr: "fri", label: "Fri" },
  { abbr: "sat", label: "Sat" },
  { abbr: "sun", label: "Sun" },
];

interface Props {
  workDays: Set<string>;
  onToggleDay: (abbr: string) => void;
  hoursPerDay: number;
  onHoursPerDayChange: (hours: number) => void;
}

export default function ScheduleSettings({
  workDays,
  onToggleDay,
  hoursPerDay,
  onHoursPerDayChange,
}: Props) {
  return (
    <div className="schedule">
      <p className="schedule-label">
        Schedule used to guess Shift / Planned hours
        <span className="schedule-hint">
          {" "}
          — there's no roster in the PDF, this is a guess
        </span>
      </p>
      <div className="schedule-days">
        {DAYS.map(({ abbr, label }) => (
          <button
            key={abbr}
            type="button"
            className={`day-chip ${workDays.has(abbr) ? "day-chip-on" : ""}`}
            onClick={() => onToggleDay(abbr)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="schedule-label schedule-hours-label">
        Planned hours per scheduled day
        <span className="schedule-hint">
          {" "}
          — time worked beyond this goes to overtime; Sunday work always
          does
        </span>
      </p>
      <div className="hour-tiles">
        {HOURS_OPTIONS.map((h) => (
          <button
            key={h}
            type="button"
            className={`hour-tile ${hoursPerDay === h ? "hour-tile-on" : ""}`}
            onClick={() => onHoursPerDayChange(h)}
          >
            <span className="hour-tile-value">{h}</span>
            <span className="hour-tile-unit">hours</span>
          </button>
        ))}
      </div>
    </div>
  );
}
