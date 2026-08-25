import { useState } from 'react';
import { CalendarIcon } from './icons';

const DISMISSED_KEY = 'floss_dismissed_reminders';
// Matches the backend's own reminder window (see backend/app/appointments/
// reminders.py) so the banner and the "email" reminder agree on what
// counts as "soon" — this one is purely a same-device UX nicety though
// (dismissal lives in localStorage, not the DB), unlike the backend's,
// which is the one that actually gates the once-per-appointment send.
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

function readDismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function formatWhen(startIso) {
  const start = new Date(startIso);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const timeLabel = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel} at ${timeLabel}`;
}

export default function AppointmentReminderBanner({ appointments }) {
  const [dismissed, setDismissed] = useState(readDismissed);

  const now = Date.now();
  const soonest = (appointments || [])
    .filter((a) => a.status === 'scheduled' && !dismissed.has(a.id))
    .map((a) => ({ appointment: a, msAway: new Date(a.scheduledStart).getTime() - now }))
    .filter(({ msAway }) => msAway >= 0 && msAway <= REMINDER_WINDOW_MS)
    .sort((a, b) => a.msAway - b.msAway)[0]?.appointment;

  if (!soonest) return null;

  function handleDismiss() {
    const next = new Set(dismissed);
    next.add(soonest.id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    setDismissed(next);
  }

  return (
    <div className="reminder-banner" role="status">
      <span className="reminder-banner-icon" aria-hidden="true">
        <CalendarIcon />
      </span>
      <p className="reminder-banner-text">
        You have an appointment with Dr. {soonest.doctorName?.replace(/^Dr\.?\s*/, '')} on {formatWhen(soonest.scheduledStart)}.
      </p>
      <button type="button" className="reminder-banner-dismiss" onClick={handleDismiss} aria-label="Dismiss reminder">
        ✕
      </button>
    </div>
  );
}
