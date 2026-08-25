import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import AppLayout from '../components/AppLayout';
import { getDoctorPhoto } from '../data/doctorPhotos';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
    return (
      <AppLayout>
        <div className="page-body">
          <div className="card booking-success">
            <div className="success-check">✓</div>
            <h2 className="page-title">Appointment booked</h2>
            <p className="page-subtitle">
              With Dr. {doctor?.fullName?.replace(/^Dr\.?\s*/, '')} on{' '}
              {new Date(booked.scheduledStart).toLocaleString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
              .
            </p>
            <div className="quick-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate('/appointments')}>
                View my appointments
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

  return (
    <AppLayout>
      <div className="page-body">
        <Link to="/doctors" className="back-link">
          ← Dentists
        </Link>
        <div className="book-doctor-header" style={{ marginTop: 12 }}>
          {doctor && getDoctorPhoto(doctor.fullName) && (
            <img src={getDoctorPhoto(doctor.fullName)} alt="" className="doctor-avatar doctor-avatar-photo doctor-avatar-large" />
          )}
          <div>
            <h1 className="page-title">Book with {doctor ? doctor.fullName : '…'}</h1>
            <p className="page-subtitle">{doctor?.specialty}</p>
          </div>
        </div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div className="card">
          <label className="field" style={{ maxWidth: 220 }}>
            <span>Date</span>
            <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} />
          </label>

          {slots === null ? (
            <div className="skeleton skeleton-card" role="status" aria-live="polite">
              <span className="sr-only">Loading…</span>
            </div>
          ) : slots.length === 0 ? (
            <div className="empty-state">
              <p>No open slots on this date. Try another day.</p>
            </div>
          ) : (
            <div className="slot-grid">
              {slots.map((slot) => (
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
          )}

          {selectedSlot && (
            <>
              <label className="field" style={{ marginTop: 16 }}>
                <span>Reason for visit (optional)</span>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual check-up" />
              </label>
              <button className="btn btn-primary btn-block" onClick={handleConfirm} disabled={submitting}>
                {submitting ? 'Booking…' : `Confirm ${formatSlotTime(selectedSlot)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
