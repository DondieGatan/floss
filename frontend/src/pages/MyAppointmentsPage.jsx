import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import AppointmentCard from '../components/AppointmentCard';

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    api.get('/appointments').then((data) => setAppointments(data.appointments));
  }

  async function handleCancel(appointment) {
    await api.patch(`/appointments/${appointment.id}/cancel`, {});
    setAppointments((prev) => prev.map((a) => (a.id === appointment.id ? { ...a, status: 'cancelled' } : a)));
  }

  return (
    <AppLayout>
      <div className="page-body">
        <h1 className="page-title">My Appointments</h1>
        <p className="page-subtitle">Upcoming and past visits.</p>

        {appointments === null ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <p>You don't have any appointments yet.</p>
          </div>
        ) : (
          <div className="list-col stagger-in">
            {appointments.map((a) => (
              <AppointmentCard key={a.id} appointment={a} onCancel={handleCancel} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
