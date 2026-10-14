import { useState } from "react";
import { calendarFile } from "./reminder.js";
import { scheduleNotification } from "./notify.js";

function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReminderButton({ reminder, deadlineText, detail }) {
  const [set, setSet] = useState(false);
  const remind = () => {
    download("parkkiko-reminder.ics", calendarFile(reminder, { detail, url: location.href }));
    scheduleNotification({ title: reminder.title, body: `At ${deadlineText}. Tap to open Parkkiko.`, at: reminder.at });
    setSet(true);
  };
  return (
    <button className={`remind${set ? " done" : ""}`} onClick={remind}>
      <span className="remind-label">{set ? "Reminder added" : "Remind me"}</span>
      <span className="remind-sub">{set ? "Save the event in your calendar" : `10 min before ${deadlineText}`}</span>
    </button>
  );
}
