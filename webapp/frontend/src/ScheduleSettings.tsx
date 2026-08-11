interface Props {
  hoursPerDay: number;
  onChangeShift: () => void;
}

export default function ScheduleSettings({ hoursPerDay, onChangeShift }: Props) {
  return (
    <div className="schedule">
      <p className="schedule-label">
        Schedule used to guess Shift / Planned hours
        <span className="schedule-hint">
          {" "}
          — Mon-Fri, there's no roster in the PDF so this is a guess
        </span>
      </p>
      <p className="schedule-shift-row">
        Planned shift <strong>{hoursPerDay}h</strong>/day
        <button type="button" className="link-btn" onClick={onChangeShift}>
          Change
        </button>
      </p>
    </div>
  );
}
