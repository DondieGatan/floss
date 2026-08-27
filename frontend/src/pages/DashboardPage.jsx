import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import AppointmentCard from '../components/AppointmentCard';
import AppointmentReminderBanner from '../components/AppointmentReminderBanner';
import RescheduleModal from '../components/RescheduleModal';
import WeeklyAppointmentsChart from '../components/WeeklyAppointmentsChart';
import { ToothIcon, ClinicIcon, ChairIcon, ClipboardIcon, CalendarIcon, CheckCircleIcon } from '../components/icons';

function firstName(fullName) {
  return (fullName || '').split(' ')[0] || 'there';
}

// Local calendar date as YYYY-MM-DD — deliberately not toISOString().slice(0,
// 10), which converts to UTC first and silently rolls back to the previous
// day for any positive-UTC-offset timezone whenever local time hasn't yet
// caught up to UTC's date (e.g. GMT+4 for the first 4 hours after local
// midnight — exactly when mondayOf() below zeroes each day's clock).
function toIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Monday of the calendar week containing `date` — clinics run on a
// Mon-Sun weekly availability pattern (see DoctorAvailability), so "this
// week" means that, not a rolling 7-day window ending today.
function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function PatientDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

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

  function handleRescheduled(updated) {
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  const upcoming = (appointments || [])
    .filter((a) => a.status === 'scheduled' && new Date(a.scheduledStart) >= new Date())
    .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));

  return (
    <div className="page-body dashboard-page">
      <div className="hero-card">
        <p className="hero-eyebrow" aria-hidden="true">
          <ToothIcon /> Patient Portal
        </p>
        <h1 className="hero-greeting">Welcome back, {firstName(user?.fullName)}</h1>
        <p className="hero-sub">Here's what's coming up with your care.</p>
      </div>

      {appointments !== null && <AppointmentReminderBanner appointments={appointments} />}

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true"><CalendarIcon /></div>
          <div className="stat-body">
            <p className="stat-value">{appointments === null ? '–' : upcoming.length}</p>
            <p className="stat-label">Upcoming appointments</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-success" aria-hidden="true"><CheckCircleIcon /></div>
          <div className="stat-body">
            <p className="stat-value">
              {appointments === null ? '–' : appointments.filter((a) => a.status === 'completed').length}
            </p>
            <p className="stat-label">Past visits</p>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Upcoming appointments</h2>
          <Link className="back-link" to="/appointments">
            History →
          </Link>
        </div>
        {appointments === null ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true"><CalendarIcon /></div>
            <p>No upcoming appointments. Ready to book one?</p>
            <Link className="btn btn-primary" to="/doctors">
              Book an appointment
            </Link>
          </div>
        ) : (
          <div className="list-col stagger-in">
            {upcoming.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                onCancel={handleCancel}
                onReschedule={setRescheduleTarget}
              />
            ))}
          </div>
        )}
      </div>

      {rescheduleTarget && (
        <RescheduleModal
          appointment={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={handleRescheduled}
        />
      )}
    </div>
  );
}

function StaffDashboard() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [admissions, setAdmissions] = useState(null);
  const [availableBeds, setAvailableBeds] = useState(null);
  const [weekly, setWeekly] = useState(null);

  useEffect(() => {
    const todayStr = toIso(new Date());
    api.get(`/appointments?date=${todayStr}`).then((data) => setToday(data.appointments));
    api.get('/admissions?status=active').then((data) => setAdmissions(data.admissions));
    api.get('/admissions/beds?status=available').then((data) => setAvailableBeds(data.beds));

    const monday = mondayOf(new Date());
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
    // perPage=200 rather than paginating — a single clinic day realistically
    // never approaches that, and this only needs a count, not the list.
    Promise.all(weekDates.map((d) => api.get(`/appointments?date=${toIso(d)}&perPage=200`))).then((results) => {
      const todayIso = toIso(new Date());
      setWeekly(
        weekDates.map((d, i) => ({
          label: d.toLocaleDateString(undefined, { weekday: 'short' }),
          count: results[i].appointments.filter((a) => a.status !== 'cancelled').length,
          isToday: toIso(d) === todayIso,
        }))
      );
    });
  }, []);

  return (
    <div className="page-body dashboard-page">
      <div className="hero-card">
        <p className="hero-eyebrow" aria-hidden="true">
          <ClinicIcon /> Staff Portal
        </p>
        <h1 className="hero-greeting">Welcome back, {firstName(user?.fullName)}</h1>
        <p className="hero-sub">Here's today's snapshot across the clinic.</p>
        <div className="quick-actions">
          <Link className="quick-action-btn" to="/manage/directory">
            <ToothIcon /> Manage directory
          </Link>
          <Link className="quick-action-btn" to="/manage/admissions">
            <ChairIcon /> Treatment rooms
          </Link>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true"><ClipboardIcon /></div>
          <div className="stat-body">
            <p className="stat-value">{today === null ? '–' : today.length}</p>
            <p className="stat-label">Appointments today</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-warning" aria-hidden="true"><ChairIcon /></div>
          <div className="stat-body">
            <p className="stat-value">{admissions === null ? '–' : admissions.length}</p>
            <p className="stat-label">Chairs in use</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-success" aria-hidden="true"><CheckCircleIcon /></div>
          <div className="stat-body">
            <p className="stat-value">{availableBeds === null ? '–' : availableBeds.length}</p>
            <p className="stat-label">Chairs available</p>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="section-title" style={{ marginBottom: 12 }}>
          Appointments this week
        </p>
        {weekly === null ? (
          <div className="skeleton skeleton-card" role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
          </div>
        ) : (
          <WeeklyAppointmentsChart data={weekly} />
        )}
      </div>

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Today's appointments</h2>
          <Link className="back-link" to="/manage/appointments">
            View all →
          </Link>
        </div>
        {today === null ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        ) : today.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true"><CalendarIcon /></div>
            <p>No appointments scheduled for today.</p>
          </div>
        ) : (
          <div className="list-col stagger-in">
            {today.map((a) => (
              <AppointmentCard key={a.id} appointment={a} showPatient />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff' || user?.role === 'admin' || user?.role === 'owner';

  return <AppLayout>{isStaff ? <StaffDashboard /> : <PatientDashboard />}</AppLayout>;
}
