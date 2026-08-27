import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatSlotTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function RescheduleModal({ appointment, onClose, onRescheduled }) {
  const durationMinutes = Math.round(
    (new Date(appointment.scheduledEnd) - new Date(appointment.scheduledStart)) / 60000
  );
  const [date, setDate] = useState(appointment.scheduledStart.slice(0, 10));
  const [doctorId, setDoctorId] = useState(appointment.doctorId);
  const [doctors, setDoctors] = useState(null);
  const [slots, setSlots] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    api.get('/doctors').then((data) => setDoctors(data.doctors));
  }, []);

  useEffect(() => {
    setSlots(null);
    setSelectedSlot(null);
    api
      .get(`/appointments/availability?doctorId=${doctorId}&date=${date}&durationMinutes=${durationMinutes}`)
      .then((data) => setSlots(data.slots));
  }, [doctorId, date, durationMinutes]);

  const selectedDoctorName =
    doctors?.find((d) => d.id === doctorId)?.fullName?.replace(/^Dr\.?\s*/, '') ??
    appointment.doctorName?.replace(/^Dr\.?\s*/, '');

  // Same focus-trap + Escape-to-close pattern as AdmissionsPage's AdmitModal.
  useEffect(() => {
    cardRef.current?.focus();
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusables = cardRef.current.querySelectorAll('input, select, button:not([disabled])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.patch(`/appointments/${appointment.id}/reschedule`, {
        scheduledStart: selectedSlot,
        doctorId,
      });
      onRescheduled(data.appointment);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-modal-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        ref={cardRef}
      >
        <h3 className="section-title" id="reschedule-modal-title">
          Reschedule with Dr. {selectedDoctorName}
        </h3>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <label className="field" style={{ maxWidth: 260 }}>
          <span>Dentist</span>
          <select value={doctorId} onChange={(e) => setDoctorId(Number(e.target.value))} disabled={doctors === null}>
            {doctors === null ? (
              <option>Loading…</option>
            ) : (
              doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))
            )}
          </select>
        </label>

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

        <div className="quick-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleConfirm}
            disabled={!selectedSlot || submitting}
          >
            {submitting ? 'Saving…' : selectedSlot ? `Confirm ${formatSlotTime(selectedSlot)}` : 'Confirm'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
