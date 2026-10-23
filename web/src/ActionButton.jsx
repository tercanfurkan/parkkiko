import { useState } from "react";
import { addReminder } from "./notify.js";


/**
 * The right-hand action, "Remind me, 10 min before 14:20". For a time limit, deadlineText is the
 * move-by time if the driver parks now, and tapping starts the stay, since the limit runs from then.
 */
export default function ActionButton({ action, deadlineText, detail, onStart }) {
  const [added, setAdded] = useState(false);
  const tap = () => {
    if (action.type === "start") return onStart();
    addReminder(action.reminder, { detail, deadlineText });
    setAdded(true);
  };
  const [label, sub] = added ? ["Reminder added", "Save the event in your calendar"] : ["Remind me", `10 min before ${deadlineText}`];
  return (
    <button className={`remind${added ? " done" : ""}`} onClick={tap} disabled={added}>
      <span className="remind-label">{label}</span>
      <span className="remind-sub">{sub}</span>
    </button>
  );
}
