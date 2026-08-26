import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import AppointmentCard from '../components/AppointmentCard';
import RescheduleModal from '../components/RescheduleModal';

export default function AllAppointmentsPage() {
  const [doctors, setDoctors] = useState([]);
  const [date, setDate] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [appointments, setAppointments] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  useEffect(() => {
    api.get('/doctors').then((data) => setDoctors(data.doctors));
  }, []);

  useEffect(() => {
    load();
  }, [date, doctorId]);

  function buildQuery(pageNum) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (doctorId) params.set('doctorId', doctorId);
    params.set('page', pageNum);
    return `?${params}`;
  }

  function load() {
    setAppointments(null);
    api.get(`/appointments${buildQuery(1)}`).then((data) => {
      setAppointments(data.appointments);
      setPage(1);
      setHasMore(data.hasMore);
    });
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const data = await api.get(`/appointments${buildQuery(page + 1)}`);
      setAppointments((prev) => [...prev, ...data.appointments]);
      setPage((p) => p + 1);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleCancel(appointment) {
    await api.patch(`/appointments/${appointment.id}/cancel`, {});
    setAppointments((prev) => prev.map((a) => (a.id === appointment.id ? { ...a, status: 'cancelled' } : a)));
  }

  function handleRescheduled(updated) {
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  return (
    <AppLayout>
      <div className="page-body page-body-wide">
        <h1 className="page-title">All Appointments</h1>
        <p className="page-subtitle">Clinic-wide appointment schedule.</p>

        <div className="filter-row">
          <label className="sr-only" htmlFor="appointments-date-filter">
            Date
          </label>
          <input id="appointments-date-filter" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label className="sr-only" htmlFor="appointments-doctor-filter">
            Dentist
          </label>
          <select id="appointments-doctor-filter" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">All dentists</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </div>

        {appointments === null ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <p>No appointments match this filter.</p>
          </div>
        ) : (
          <div className="list-col stagger-in">
            {appointments.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                showPatient
                onCancel={handleCancel}
                onReschedule={setRescheduleTarget}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <button
            className="btn btn-ghost btn-small"
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{ marginTop: 12 }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}

        {rescheduleTarget && (
          <RescheduleModal
            appointment={rescheduleTarget}
            onClose={() => setRescheduleTarget(null)}
            onRescheduled={handleRescheduled}
          />
        )}
      </div>
    </AppLayout>
  );
}
