import { useEffect, useState } from "react";
import { RULE_TYPES } from "./style.js";
import { evaluate } from "./evaluate.js";
import { answer, clock, clockTime, when } from "./answer.js";
import { actionFor } from "./reminder.js";
import ActionButton from "./ActionButton.jsx";

// The map colour of what applies now, so the panel and the strip on the map read as one
const TINT = { free: "free_limited", paid: "paid", no_parking: "always_banned", reserved: "reserved", check: "unknown" };

function useSecond() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function Countdown({ to, label }) {
  const time = <span className="countdown-time">{clock(to - useSecond())}</span>;
  return <div className="countdown">{label === "left" ? <>{time} left</> : <>{label} {time}</>}</div>;
}

// The bar when the panel is closed and a stay is running: the countdown stays in sight
function ParkedBar({ stay, onOpen }) {
  const left = stay.deadline - useSecond();
  return (
    <button className="panel parked-bar" onClick={onOpen}>
      {left > 0 ? <>Parked · <strong>{clock(left)}</strong> left</> : <strong>Time is up. Move your car</strong>}
    </button>
  );
}

export default function RulePanel({ area, zoomedIn, calendar, now, onClose, stay, onStart, onOpenStay }) {
  if (!area) {
    if (stay) return <ParkedBar stay={stay} onOpen={onOpenStay} />;
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
  const parked = stay?.areaId === area.id;
  const action = !parked && result && actionFor(result, now.getTime());
  return (
    <div className="panel open">
      <div className="info" style={{ "--tint": tint }}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        {parked ? (
          <>
            <div className="headline">{stay.deadline > now ? `Parked. Move by ${clockTime(stay.deadline)}` : "Time is up. Move your car"}</div>
            <Countdown to={stay.deadline} label="left" />
            <div>{headline}</div>
            {stay.disc && <div>Parking disc set to {clockTime(stay.disc)}</div>}
          </>
        ) : (
          <>
            <div className="headline">{headline}</div>
            {countdown && <Countdown {...countdown} />}
            {detail && <div>{detail}</div>}
          </>
        )}
        {area.extra_info && <div className="note">Sign note: {area.extra_info}</div>}
      </div>
      {parked && (
        <div className="action">
          <div className="remind done">
            <span className="remind-label">Reminder added</span>
            <span className="remind-sub">10 min before {clockTime(stay.deadline)}</span>
          </div>
        </div>
      )}
      {action && (
        <div className="action">
          <ActionButton
            key={`${area.id}-${action.type}`}
            action={action}
            deadlineText={when(result.until)}
            detail={[headline, detail].filter(Boolean).join(". ")}
            onStart={() => onStart(area)}
          />
        </div>
      )}
    </div>
  );
}
