import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import AppointmentCard from '../components/AppointmentCard';

export default function AllAppointmentsPage() {
  const [doctors, setDoctors] = useState([]);
  const [date, setDate] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [appointments, setAppointments] = useState(null);

  useEffect(() => {
    api.get('/doctors').then((data) => setDoctors(data.doctors));
  }, []);

  useEffect(() => {
    load();
  }, [date, doctorId]);

  function load() {
    setAppointments(null);
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (doctorId) params.set('doctorId', doctorId);
    const query = params.toString() ? `?${params}` : '';
    api.get(`/appointments${query}`).then((data) => setAppointments(data.appointments));
  }

  async function handleCancel(appointment) {
    await api.patch(`/appointments/${appointment.id}/cancel`, {});
    setAppointments((prev) => prev.map((a) => (a.id === appointment.id ? { ...a, status: 'cancelled' } : a)));
  }

  return (
    <AppLayout>
      <div className="page-body page-body-wide">
        <h1 className="page-title">All Appointments</h1>
        <p className="page-subtitle">Clinic-wide appointment schedule.</p>

        <div className="filter-row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">All dentists</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </div>

        {appointments === null ? (
          <>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </>
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <p>No appointments match this filter.</p>
          </div>
        ) : (
          <div className="list-col stagger-in">
            {appointments.map((a) => (
              <AppointmentCard key={a.id} appointment={a} showPatient onCancel={handleCancel} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
