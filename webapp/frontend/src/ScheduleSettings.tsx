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
      <label className="schedule-hours">
        Hours per scheduled day
        <input
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={hoursPerDay}
          onChange={(e) => onHoursPerDayChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
