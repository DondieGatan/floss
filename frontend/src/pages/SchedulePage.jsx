import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';

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

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function SchedulePage() {
  const [date, setDate] = useState(todayIso());
  const [doctors, setDoctors] = useState(null);
  const [entriesByDoctor, setEntriesByDoctor] = useState(null);

  useEffect(() => {
    load();
  }, [date]);

  async function load() {
    setEntriesByDoctor(null);
    const [{ doctors: docs }, { appointments }] = await Promise.all([
      api.get('/doctors'),
      api.get(`/appointments?date=${date}&perPage=200`),
    ]);
    setDoctors(docs);

    // One availability lookup per dentist, in parallel — same endpoint the
    // booking page uses, so "available" here always matches what a patient
    // could actually book.
    const slotResults = await Promise.all(
      docs.map((doc) => api.get(`/appointments/availability?doctorId=${doc.id}&date=${date}&durationMinutes=30`))
    );

    const byDoctor = {};
    docs.forEach((doc, i) => {
      const booked = appointments.filter((a) => a.doctorId === doc.id && a.status !== 'cancelled');
      const entries = [
        ...slotResults[i].slots.map((s) => ({ type: 'available', start: s })),
        ...booked.map((a) => ({
          type: 'booked',
          start: a.scheduledStart,
          end: a.scheduledEnd,
          patientName: a.patientName,
          reason: a.reason,
        })),
      ].sort((x, y) => new Date(x.start) - new Date(y.start));
      byDoctor[doc.id] = entries;
    });
    setEntriesByDoctor(byDoctor);
  }

  return (
    <AppLayout>
      <div className="page-body page-body-wide">
        <h1 className="page-title">Schedule</h1>
        <p className="page-subtitle">Who's available and who's booked, dentist by dentist.</p>

        <div className="filter-row">
          <label className="sr-only" htmlFor="schedule-date">
            Date
          </label>
          <input id="schedule-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {doctors === null || entriesByDoctor === null ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        ) : doctors.length === 0 ? (
          <div className="empty-state">
            <p>No dentists in the directory yet.</p>
          </div>
        ) : (
          <div className="list-col">
            {doctors.map((doc) => {
              const entries = entriesByDoctor[doc.id] || [];
              return (
                <div key={doc.id} className="card">
                  <p style={{ fontWeight: 700, margin: 0 }}>{doc.fullName}</p>
                  <p className="page-subtitle" style={{ margin: '2px 0 12px' }}>
                    {doc.specialty}
                  </p>
                  {entries.length === 0 ? (
                    <span className="page-subtitle" style={{ margin: 0 }}>
                      Not available on this date.
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {entries.map((entry, i) =>
                        entry.type === 'available' ? (
                          <span key={i} className="status-badge status-badge-available">
                            {formatTime(entry.start)} · Available
                          </span>
                        ) : (
                          <span key={i} className="status-badge status-badge-occupied">
                            {formatTime(entry.start)}–{formatTime(entry.end)} · {entry.patientName}
                            {entry.reason ? ` · ${entry.reason}` : ''}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
