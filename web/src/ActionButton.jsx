import { useState } from "react";
import { addReminder } from "./notify.js";

const LABELS = {
  start: ["Start parking", "When you leave the car"],
  remind: ["Remind me", null],
  done: ["Reminder added", "Save the event in your calendar"],
};

/** The right-hand action: start a time-limited stay, or a reminder before a fixed deadline. */
export default function ActionButton({ action, deadlineText, detail, onStart }) {
  const [added, setAdded] = useState(false);
  const tap = () => {
    if (action.type === "start") return onStart();
    addReminder(action.reminder, { detail, deadlineText });
    setAdded(true);
  };
  const [label, sub] = added ? LABELS.done : action.type === "start" ? LABELS.start : [LABELS.remind[0], `10 min before ${deadlineText}`];
  return (
    <button className={`remind${added ? " done" : ""}`} onClick={tap} disabled={added}>
      <span className="remind-label">{label}</span>
      <span className="remind-sub">{sub}</span>
    </button>
  );
}
