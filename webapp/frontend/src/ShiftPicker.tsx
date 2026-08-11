const SHIFT_OPTIONS = [10, 9, 8];

interface Props {
  onSelect: (hours: number) => void;
}

export default function ShiftPicker({ onSelect }: Props) {
  return (
    <main className="panel shift-picker">
      <p className="shift-picker-label">What's today's planned shift length?</p>
      <div className="shift-tiles">
        {SHIFT_OPTIONS.map((h) => (
          <button
            key={h}
            type="button"
            className="shift-tile"
            onClick={() => onSelect(h)}
          >
            <span className="shift-tile-value">{h}</span>
            <span className="shift-tile-unit">hour shift</span>
          </button>
        ))}
      </div>
      <p className="shift-picker-hint">
        Time worked beyond this goes to overtime — Sunday work always does.
        You can change this later.
      </p>
    </main>
  );
}
