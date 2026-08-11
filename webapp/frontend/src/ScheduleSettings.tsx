interface Props {
  hoursPerDay: number;
  onChangeShift: () => void;
  includeSaturday: boolean;
  onIncludeSaturdayChange: (include: boolean) => void;
}

export default function ScheduleSettings({
  hoursPerDay,
  onChangeShift,
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
      <p className="schedule-shift-row">
        Planned shift <strong>{hoursPerDay}h</strong>/day
        <button type="button" className="link-btn" onClick={onChangeShift}>
          Change
        </button>
      </p>
    </div>
  );
}
