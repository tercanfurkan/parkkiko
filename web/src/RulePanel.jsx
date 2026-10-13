import { RULE_TYPES } from "./style.js";
import { evaluate } from "./evaluate.js";
import { answer } from "./answer.js";

export default function RulePanel({ area, zoomedIn, calendar, now, onClose }) {
  if (!area) {
    return (
      <div className="panel">
        {zoomedIn ? "Tap a street section to see its rule." : "Zoom in to see parking rules."}
      </div>
    );
  }
  // Until the holiday calendar is in, a time could be wrong on a holiday, so say nothing yet
  const { headline, detail } = calendar ? answer(area, evaluate(area, now, calendar)) : { headline: "Checking…" };
  const { label, colour } = RULE_TYPES[area.rule_type] ?? RULE_TYPES.unknown;
  return (
    <div className="panel open">
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      <div className="headline">{headline}</div>
      {detail && <div>{detail}</div>}
      {/* The map colour with its name, so the colours on the map can be read */}
      {headline !== `${label}.` && <div className="rule"><span className="swatch" style={{ background: colour }} />{label}</div>}
      {area.extra_info && <div className="rule">Sign note: {area.extra_info}</div>}
    </div>
  );
}
