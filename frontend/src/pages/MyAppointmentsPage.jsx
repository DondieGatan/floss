import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import AppointmentCard from '../components/AppointmentCard';

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
          <div className="list-col stagger-in">
            {history.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
