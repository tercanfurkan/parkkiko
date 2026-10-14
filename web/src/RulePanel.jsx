import { useEffect, useState } from "react";
import { RULE_TYPES } from "./style.js";
import { evaluate } from "./evaluate.js";
import { answer, clock } from "./answer.js";

// The map colour of what applies now, so the panel and the strip on the map read as one
const TINT = { free: "free_limited", paid: "paid", no_parking: "always_banned", reserved: "reserved", check: "unknown" };

function Countdown({ to, label }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const time = <span className="countdown-time">{clock(to - now)}</span>;
  return <div className="countdown">{label === "left" ? <>{time} left</> : <>{label} {time}</>}</div>;
}

export default function RulePanel({ area, zoomedIn, calendar, now, onClose, action }) {
  if (!area) {
    return (
      <div className="panel">
        {zoomedIn ? "Tap a street section to see its rule." : "Zoom in to see parking rules."}
      </div>
    );
  }
  // Until the holiday calendar is in, a time could be wrong on a holiday, so say nothing yet
  const result = calendar && evaluate(area, now, calendar);
  const { headline, detail, countdown } = result ? answer(area, result, now.getTime()) : { headline: "Checking…" };
  const tint = RULE_TYPES[TINT[result?.kind] ?? "unknown"].colour;
  return (
    <div className="panel open">
      <div className="info" style={{ "--tint": tint }}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="headline">{headline}</div>
        {countdown && <Countdown {...countdown} />}
        {detail && <div>{detail}</div>}
        {area.extra_info && <div className="note">Sign note: {area.extra_info}</div>}
      </div>
      {action && <div className="action">{action}</div>}
    </div>
  );
}
