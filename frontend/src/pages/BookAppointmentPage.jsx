import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import AppLayout from '../components/AppLayout';
import { resolveDoctorPhoto } from '../data/doctorPhotos';

// Local calendar date as YYYY-MM-DD — not toISOString().slice(0, 10), which
// converts to UTC first and silently rolls back to the previous day for any
// positive-UTC-offset timezone during the first few hours after local
// midnight.
function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initials(name) {
  return (name || '')
    .replace(/^Dr\.?\s*/, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

// Slots grouped into parts of the day, so a long list is easier to scan.
function groupSlots(slots) {
  const parts = [
    { label: 'Morning', slots: [] },
    { label: 'Afternoon', slots: [] },
    { label: 'Evening', slots: [] },
  ];
  slots.forEach((slot) => {
    const hour = new Date(slot).getHours();
    parts[hour < 12 ? 0 : hour < 17 ? 1 : 2].slots.push(slot);
  });
  return parts.filter((part) => part.slots.length > 0);
}

function formatSlotTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function BookAppointmentPage() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(null);

  useEffect(() => {
    api.get(`/doctors/${doctorId}`).then((data) => setDoctor(data.doctor));
  }, [doctorId]);

  useEffect(() => {
    setSlots(null);
    setSelectedSlot(null);
    api
      .get(`/appointments/availability?doctorId=${doctorId}&date=${date}&durationMinutes=30`)
      .then((data) => setSlots(data.slots));
  }, [doctorId, date]);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/appointments', {
        doctorId: Number(doctorId),
        scheduledStart: selectedSlot,
        durationMinutes: 30,
        reason: reason.trim() || undefined,
      });
      setBooked(data.appointment);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (booked) {
    const bookedPhoto = doctor && resolveDoctorPhoto(doctor);
    return (
      <AppLayout>
        <div className="page-body">
          <div className="card booking-success">
            <div className="success-check">✓</div>
            <h2 className="page-title">Appointment booked</h2>
            <p className="page-subtitle">You're all set. A reminder will come before your visit.</p>
            <div className="booking-receipt">
              <div className="booking-receipt-row">
                <span className="booking-receipt-label">Dentist</span>
                <span className="booking-receipt-value">
                  {bookedPhoto && <img src={bookedPhoto} alt="" className="booking-receipt-photo" />}
                  Dr. {doctor?.fullName?.replace(/^Dr\.?\s*/, '')}
                </span>
              </div>
              <div className="booking-receipt-row">
                <span className="booking-receipt-label">When</span>
                <span className="booking-receipt-value">
                  {new Date(booked.scheduledStart).toLocaleString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {booked.reason && (
                <div className="booking-receipt-row">
                  <span className="booking-receipt-label">Reason</span>
                  <span className="booking-receipt-value">{booked.reason}</span>
                </div>
              )}
            </div>
            <div className="quick-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                Go to dashboard
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/doctors')}>
                Back to dentists
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const photo = doctor && resolveDoctorPhoto(doctor);

  return (
    <AppLayout>
      <div className="page-body page-body-wide booking-page">
        <Link to="/doctors" className="back-link">
          ← Dentists
        </Link>

        <div className="booking-layout">
          <aside className="booking-profile card">
            {doctor === null ? (
              <div className="skeleton skeleton-card" aria-hidden="true" />
            ) : (
              <>
                {photo ? (
                  <img src={photo} alt="" className="booking-profile-photo" />
                ) : (
                  <div className="booking-profile-photo booking-profile-initials" aria-hidden="true">
                    {initials(doctor.fullName)}
                  </div>
                )}
                <h2 className="booking-profile-name">{doctor.fullName}</h2>
                <p className="booking-profile-specialty">{doctor.specialty}</p>
                {doctor.departmentName && <span className="booking-profile-dept">{doctor.departmentName}</span>}
                {doctor.bio && <p className="booking-profile-bio">{doctor.bio}</p>}
              </>
            )}
          </aside>

          <section className="booking-panel card">
            <h1 className="page-title">Book with {doctor ? doctor.fullName : '…'}</h1>
            <p className="page-subtitle">Pick a day, then a time that suits you.</p>

            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <div className="booking-step">
              <span className="booking-step-num" aria-hidden="true">1</span>
              <label className="field booking-step-body">
                <span>Date</span>
                <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} />
              </label>
            </div>

            <div className="booking-step">
              <span className="booking-step-num" aria-hidden="true">2</span>
              <div className="booking-step-body">
                <p className="booking-step-title">Time</p>
                {slots === null ? (
                  <div className="skeleton skeleton-card" role="status" aria-live="polite">
                    <span className="sr-only">Loading…</span>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="empty-state">
                    <p>No open slots on this date. Try another day.</p>
                  </div>
                ) : (
                  groupSlots(slots).map((part) => (
                    <div key={part.label} className="slot-group">
                      <p className="slot-group-label">{part.label}</p>
                      <div className="slot-grid">
                        {part.slots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            className={`slot-btn${selectedSlot === slot ? ' selected' : ''}`}
                            onClick={() => setSelectedSlot(slot)}
                            aria-pressed={selectedSlot === slot}
                          >
                            {formatSlotTime(slot)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {selectedSlot && (
              <div className="booking-step">
                <span className="booking-step-num" aria-hidden="true">3</span>
                <div className="booking-step-body">
                  <label className="field">
                    <span>Reason for visit (optional)</span>
                    <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual check-up" />
                  </label>
                  <p className="booking-summary">
                    {new Date(selectedSlot).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    {' · '}
                    {formatSlotTime(selectedSlot)} · 30 minutes
                  </p>
                  <button className="btn btn-primary btn-block" onClick={handleConfirm} disabled={submitting}>
                    {submitting ? 'Booking…' : `Confirm ${formatSlotTime(selectedSlot)}`}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
