interface Props {
  hoursPerDay: number;
  onChangeShift: () => void;
  rotating: boolean;
  includeSaturday: boolean;
  onIncludeSaturdayChange: (include: boolean) => void;
}

export default function ScheduleSettings({
  hoursPerDay,
  onChangeShift,
  rotating,
  includeSaturday,
  onIncludeSaturdayChange,
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
      {rotating ? (
        <p className="schedule-hint schedule-rotating-note">
          Rotating shift (e.g. 4 days on, 4 off) — any day with a clocking
          counts as a scheduled {hoursPerDay}h day, no fixed week.
        </p>
      ) : (
        <div className="week-toggle">
          <button
            type="button"
            className={`week-option ${!includeSaturday ? "week-option-on" : ""}`}
            onClick={() => onIncludeSaturdayChange(false)}
          >
            Mon–Fri
          </button>
          <button
            type="button"
            className={`week-option ${includeSaturday ? "week-option-on" : ""}`}
            onClick={() => onIncludeSaturdayChange(true)}
          >
            Mon–Sat
          </button>
        </div>
      )}
      <p className="schedule-shift-row">
        Planned shift <strong>{hoursPerDay}h</strong>/day
        <button type="button" className="link-btn" onClick={onChangeShift}>
          Change
        </button>
      </p>
    </div>
  );
}
