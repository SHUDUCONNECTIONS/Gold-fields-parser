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
  onChangeShift: () => void;
}

export default function ScheduleSettings({
  workDays,
  onToggleDay,
  hoursPerDay,
  onChangeShift,
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
      <p className="schedule-shift-row">
        Planned shift <strong>{hoursPerDay}h</strong>/day
        <button type="button" className="link-btn" onClick={onChangeShift}>
          Change
        </button>
      </p>
    </div>
  );
}
