import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import AppointmentCard from '../components/AppointmentCard';

function firstName(fullName) {
  return (fullName || '').split(' ')[0] || 'there';
}

function PatientDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState(null);

  useEffect(() => {
    api.get('/appointments').then((data) => setAppointments(data.appointments));
  }, []);

  const upcoming = (appointments || [])
    .filter((a) => a.status === 'scheduled' && new Date(a.scheduledStart) >= new Date())
    .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));

  return (
    <div className="page-body">
      <div className="hero-card">
        <p className="hero-eyebrow" aria-hidden="true">
          🦷 Patient Portal
        </p>
        <p className="hero-greeting">Welcome back, {firstName(user?.fullName)}</p>
        <p className="hero-sub">Here's what's coming up with your care.</p>
        <div className="quick-actions">
          <Link className="quick-action-btn" to="/doctors">
            + Book an appointment
          </Link>
          <Link className="quick-action-btn" to="/knowledge-base">
            💬 Ask Floss Clinic a question
          </Link>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true">📅</div>
          <div className="stat-body">
            <p className="stat-value">{appointments === null ? '–' : upcoming.length}</p>
            <p className="stat-label">Upcoming appointments</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-success" aria-hidden="true">✅</div>
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
            View all →
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
            <div className="empty-state-icon" aria-hidden="true">🗓️</div>
            <p>No upcoming appointments. Ready to book one?</p>
            <Link className="btn btn-primary btn-small" to="/doctors">
              + Book an appointment
            </Link>
          </div>
        ) : (
          <div className="list-col stagger-in">
            {upcoming.slice(0, 4).map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StaffDashboard() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [admissions, setAdmissions] = useState(null);
  const [availableBeds, setAvailableBeds] = useState(null);

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    api.get(`/appointments?date=${todayStr}`).then((data) => setToday(data.appointments));
    api.get('/admissions?status=active').then((data) => setAdmissions(data.admissions));
    api.get('/admissions/beds?status=available').then((data) => setAvailableBeds(data.beds));
  }, []);

  return (
    <div className="page-body">
      <div className="hero-card">
        <p className="hero-eyebrow" aria-hidden="true">
          🏥 Staff Portal
        </p>
        <p className="hero-greeting">Welcome back, {firstName(user?.fullName)}</p>
        <p className="hero-sub">Here's today's snapshot across the clinic.</p>
        <div className="quick-actions">
          <Link className="quick-action-btn" to="/manage/directory">
            🦷 Manage directory
          </Link>
          <Link className="quick-action-btn" to="/manage/admissions">
            🪑 Treatment rooms
          </Link>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true">📋</div>
          <div className="stat-body">
            <p className="stat-value">{today === null ? '–' : today.length}</p>
            <p className="stat-label">Appointments today</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-warning" aria-hidden="true">🪑</div>
          <div className="stat-body">
            <p className="stat-value">{admissions === null ? '–' : admissions.length}</p>
            <p className="stat-label">Chairs in use</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-success" aria-hidden="true">✅</div>
          <div className="stat-body">
            <p className="stat-value">{availableBeds === null ? '–' : availableBeds.length}</p>
            <p className="stat-label">Chairs available</p>
          </div>
        </div>
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
            <div className="empty-state-icon" aria-hidden="true">🗓️</div>
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
  const isStaff = user?.role === 'staff' || user?.role === 'admin';

  return <AppLayout>{isStaff ? <StaffDashboard /> : <PatientDashboard />}</AppLayout>;
}
