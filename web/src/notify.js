// The bonus half of a reminder: a notification at the reminder time, but only while the browser
// keeps the page running. Phones pause background tabs, and iOS Safari only notifies an installed
// app, so the calendar event is the reminder and this never stands in for it.

import { calendarFile } from "./reminder.js";

const KEY = "parkkiko.reminder";
const STAY_KEY = "parkkiko.stay";
const SW_URL = `${import.meta.env.BASE_URL}sw.js`;
let timer = null;

function arm({ title, body, at }) {
  clearTimeout(timer);
  const wait = at - Date.now();
  if (wait <= 0) return;
  timer = setTimeout(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, { body, tag: "parkkiko-reminder" });
    } catch {
      // nothing to do: the calendar alarm is the reminder
    }
  }, wait);
}

/** Ask for permission (must run in the tap's handler) and schedule. Resolves to whether it will notify. */
export async function scheduleNotification(reminder) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register(SW_URL);
    if ((await Notification.requestPermission()) !== "granted") return false;
    localStorage.setItem(KEY, JSON.stringify(reminder));
  } catch {
    return false;
  }
  arm(reminder);
  return true;
}

/** Re-arm a reminder set before a reload. */
export function restoreNotification() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.at > Date.now() && Notification.permission === "granted") arm(saved);
  } catch {
    // no storage, or nothing saved
  }
}

function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The calendar event, which is the reminder, and the notification as a bonus. Call from a tap. */
export function addReminder(reminder, { detail, deadlineText }) {
  download("parkkiko-reminder.ics", calendarFile(reminder, { detail, url: location.href }));
  scheduleNotification({ title: reminder.title, body: `At ${deadlineText}. Tap to open Parkkiko.`, at: reminder.at });
}

/** The stay the driver started, if it has not run out yet. Survives a reload. */
export function loadStay() {
  try {
    const stay = JSON.parse(localStorage.getItem(STAY_KEY));
    return stay?.deadline > Date.now() ? stay : null;
  } catch {
    return null;
  }
}

export function saveStay(stay) {
  try {
    localStorage.setItem(STAY_KEY, JSON.stringify(stay));
  } catch {
    // private mode: the stay lasts until the page closes
  }
}
