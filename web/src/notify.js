// The bonus half of a reminder: a notification at the reminder time, but only while the browser
// keeps the page running. Phones pause background tabs, and iOS Safari only notifies an installed
// app, so the calendar event is the reminder and this never stands in for it.

const KEY = "parkkiko.reminder";
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
