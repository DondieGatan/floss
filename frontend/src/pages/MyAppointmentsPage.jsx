import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import AppointmentCard from '../components/AppointmentCard';
import { CalendarIcon, CheckCircleIcon, ClipboardIcon } from '../components/icons';

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState(null);

  useEffect(() => {
    api.get('/appointments').then((data) => setAppointments(data.appointments));
  }, []);

  // Upcoming, still-scheduled appointments now live on the dashboard, where
  // they can be cancelled or rescheduled — this page is a read-only record
  // of everything else: completed, no-show, or scheduled appointments whose
  // time has simply passed without ever being marked either way. Cancelled
  // appointments are deliberately excluded from history entirely.
  const history = (appointments || [])
    .filter((a) => a.status !== 'cancelled' && (a.status !== 'scheduled' || new Date(a.scheduledStart) < new Date()))
    .sort((a, b) => new Date(b.scheduledStart) - new Date(a.scheduledStart));

  const completedCount = history.filter((a) => a.status === 'completed').length;
  const missedCount = history.filter((a) => a.status === 'no_show').length;
  const lastVisit = history.find((a) => a.status === 'completed');

  // Month by month, newest first, so a long history reads as a timeline.
  const groups = [];
  history.forEach((a) => {
    const label = new Date(a.scheduledStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const current = groups[groups.length - 1];
    if (current && current.label === label) current.items.push(a);
    else groups.push({ label, items: [a] });
  });

  return (
    <AppLayout>
      <div className="page-body">
        <h1 className="page-title">Appointment History</h1>
        <p className="page-subtitle">Your past visits.</p>

        {appointments === null ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <p>No past visits yet.</p>
          </div>
        ) : (
          <>
            <div className="stat-row history-stats">
              <div className="stat-card">
                <div className="stat-icon stat-icon-success" aria-hidden="true"><CheckCircleIcon /></div>
                <div className="stat-body">
                  <p className="stat-value">{completedCount}</p>
                  <p className="stat-label">Completed visits</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon-warning" aria-hidden="true"><ClipboardIcon /></div>
                <div className="stat-body">
                  <p className="stat-value">{missedCount}</p>
                  <p className="stat-label">Missed</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" aria-hidden="true"><CalendarIcon /></div>
                <div className="stat-body">
                  <p className="stat-value stat-value-text">
                    {lastVisit
                      ? new Date(lastVisit.scheduledStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : '–'}
                  </p>
                  <p className="stat-label">Last visit</p>
                </div>
              </div>
            </div>
            {groups.map((group) => (
              <div key={group.label} className="history-group">
                <h2 className="history-month">{group.label}</h2>
                <div className="list-col stagger-in">
                  {group.items.map((a) => (
                    <AppointmentCard key={a.id} appointment={a} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </AppLayout>
  );
}
