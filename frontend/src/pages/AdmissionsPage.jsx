import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import AppLayout from '../components/AppLayout';

// Chair status was color-only (available/occupied/maintenance backgrounds)
// with no other visual cue — a color-blind sighted user had no way to
// distinguish them at a glance, even though the aria-label already covered
// screen readers.
const BED_STATUS_LABEL = { available: 'Open', occupied: 'In use', maintenance: 'Maint.' };

function WardForm({ onCreated }) {
  const [name, setName] = useState('');
  const [wardType, setWardType] = useState('');
  const [floor, setFloor] = useState('');
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const data = await api.post('/wards', { name, wardType, floor: floor || undefined });
      setName('');
      setWardType('');
      setFloor('');
      onCreated(data.ward);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="filter-row" style={{ marginBottom: 0, alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Room name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Area</span>
          <input value={wardType} onChange={(e) => setWardType(e.target.value)} placeholder="General Treatment" required />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Floor</span>
          <input value={floor} onChange={(e) => setFloor(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          + Add room
        </button>
      </div>
    </form>
  );
}

function AddBedInline({ wardId, onAdded }) {
  const [bedNumber, setBedNumber] = useState('');
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/wards/${wardId}/beds`, { bedNumber });
      setBedNumber('');
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6, marginTop: 10 }}>
      {error && (
        <span className="form-error" role="alert" style={{ marginBottom: 0 }}>
          {error}
        </span>
      )}
      <input
        style={{ maxWidth: 110, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
        placeholder="Chair #"
        aria-label="Chair number"
        value={bedNumber}
        onChange={(e) => setBedNumber(e.target.value)}
        required
      />
      <button className="btn btn-small btn-secondary" type="submit">
        + Add chair
      </button>
    </form>
  );
}

function AdmitModal({ bed, patients, doctors, onClose, onAdmitted }) {
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const firstFieldRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !formRef.current) return;
      const focusables = formRef.current.querySelectorAll('input, select, button:not([disabled])');
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/admissions', {
        patientId: Number(patientId),
        bedId: bed.id,
        admittingDoctorId: doctorId ? Number(doctorId) : undefined,
        reason: reason || undefined,
      });
      onAdmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admit-modal-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <h3 className="section-title" id="admit-modal-title">
          Seat in {bed.wardName} · Chair {bed.bedNumber}
        </h3>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <label className="field">
          <span>Patient</span>
          <select ref={firstFieldRef} value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
            <option value="" disabled>
              Select a patient
            </option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Attending dentist (optional)</span>
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">None</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Reason (optional)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="quick-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Seating…' : 'Seat patient'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdmissionsPage() {
  const [wards, setWards] = useState(null);
  const [beds, setBeds] = useState({});
  const [admissions, setAdmissions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [admitBed, setAdmitBed] = useState(null);
  const admitTriggerRef = useRef(null);

  useEffect(() => {
    loadAll();
    // The admit-patient picker below needs every patient, not a page of
    // them — pass an explicit high perPage rather than paginating a plain
    // <select> (see app/pagination.py for the endpoint's actual cap).
    api.get('/patients?perPage=200').then((data) => setPatients(data.patients));
    api.get('/doctors').then((data) => setDoctors(data.doctors));
  }, []);

  function loadAll() {
    api.get('/wards').then(async (data) => {
      setWards(data.wards);
      const bedLists = await Promise.all(data.wards.map((w) => api.get(`/wards/${w.id}/beds`)));
      const map = {};
      data.wards.forEach((w, i) => {
        map[w.id] = bedLists[i].beds;
      });
      setBeds(map);
    });
    api.get('/admissions?status=active').then((data) => setAdmissions(data.admissions));
  }

  async function handleDischarge(bed) {
    const admission = admissions.find((a) => a.bedId === bed.id);
    if (!admission) return;
    await api.patch(`/admissions/${admission.id}/discharge`, {});
    loadAll();
  }

  function handleBedClick(bed, triggerEl) {
    if (bed.status === 'available') {
      admitTriggerRef.current = triggerEl;
      setAdmitBed(bed);
    } else if (bed.status === 'occupied') {
      handleDischarge(bed);
    }
  }

  function closeAdmitModal() {
    setAdmitBed(null);
    admitTriggerRef.current?.focus();
  }

  return (
    <AppLayout>
      <div className="page-body page-body-wide">
        <h1 className="page-title">Treatment Rooms</h1>
        <p className="page-subtitle">Click an open chair to seat a patient, or an occupied chair to check them out.</p>

        <WardForm onCreated={loadAll} />

        {wards === null ? (
          <div className="skeleton skeleton-card" role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
          </div>
        ) : wards.length === 0 ? (
          <div className="empty-state">
            <p>No treatment rooms yet. Add one above to start tracking chairs.</p>
          </div>
        ) : (
          wards.map((ward) => (
            <div key={ward.id} className="ward-block">
              <div className="section-header">
                <h2 className="section-title">
                  {ward.name} <span className="page-subtitle" style={{ display: 'inline' }}>· {ward.wardType}</span>
                </h2>
              </div>
              <div className="bed-grid">
                {(beds[ward.id] || []).map((bed) => (
                  <button
                    key={bed.id}
                    type="button"
                    className={`bed-tile bed-tile-${bed.status}`}
                    onClick={(e) => handleBedClick(bed, e.currentTarget)}
                    aria-label={`Chair ${bed.bedNumber} — ${bed.status}`}
                  >
                    <span className="bed-tile-number">{bed.bedNumber}</span>
                    <span className="bed-tile-status" aria-hidden="true">
                      {BED_STATUS_LABEL[bed.status] || bed.status}
                    </span>
                  </button>
                ))}
              </div>
              <AddBedInline wardId={ward.id} onAdded={loadAll} />
            </div>
          ))
        )}

        {admitBed && (
          <AdmitModal
            bed={admitBed}
            patients={patients}
            doctors={doctors}
            onClose={closeAdmitModal}
            onAdmitted={() => {
              closeAdmitModal();
              loadAll();
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
