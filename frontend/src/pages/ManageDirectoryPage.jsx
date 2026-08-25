import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import AppLayout from '../components/AppLayout';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DepartmentForm({ onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/departments', { name, description: description || undefined });
      setName('');
      setDescription('');
      onCreated(data.department);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
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
        <label className="field" style={{ marginBottom: 0, flex: 1 }}>
          <span>Department name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field" style={{ marginBottom: 0, flex: 2 }}>
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : '+ Add department'}
        </button>
      </div>
    </form>
  );
}

function DepartmentCard({ department, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description || '');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function cancelEdit() {
    setEditing(false);
    setError(null);
    setName(department.name);
    setDescription(department.description || '');
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.put(`/departments/${department.id}`, { name, description: description || undefined });
      setEditing(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await api.del(`/departments/${department.id}`);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  if (editing) {
    return (
      <form className="card" onSubmit={handleSave}>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <label className="field" style={{ marginBottom: 8 }}>
          <span>Department name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field" style={{ marginBottom: 8 }}>
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-small btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn-small btn-secondary" type="button" onClick={cancelEdit}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="card">
      <p style={{ fontWeight: 700, margin: 0 }}>{department.name}</p>
      {department.description && <p className="page-subtitle" style={{ margin: '6px 0 0' }}>{department.description}</p>}
      {error && (
        <div className="form-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn btn-small btn-secondary" type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button className="btn btn-small btn-danger" type="button" onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

function AvailabilityEditor({ doctor, onChange }) {
  const [weekday, setWeekday] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [error, setError] = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/doctors/${doctor.id}/availability`, { weekday: Number(weekday), startTime, endTime });
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  async function handleRemove(availabilityId) {
    await api.del(`/doctors/${doctor.id}/availability/${availabilityId}`);
    onChange();
  }

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {(doctor.availability || []).length === 0 && <span className="page-subtitle" style={{ margin: 0 }}>No availability set.</span>}
        {(doctor.availability || []).map((a) => (
          <button
            key={a.id}
            type="button"
            className="status-badge status-badge-available"
            style={{ cursor: 'pointer', border: 'none' }}
            onClick={() => handleRemove(a.id)}
            aria-label={`Remove ${WEEKDAYS[a.weekday]} ${a.startTime}-${a.endTime} availability`}
          >
            {WEEKDAYS[a.weekday]} {a.startTime}-{a.endTime} ✕
          </button>
        ))}
      </div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="sr-only" htmlFor={`weekday-${doctor.id}`}>
          Weekday
        </label>
        <select id={`weekday-${doctor.id}`} value={weekday} onChange={(e) => setWeekday(e.target.value)}>
          {WEEKDAYS.map((w, i) => (
            <option key={w} value={i}>
              {w}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`start-${doctor.id}`}>
          Start time
        </label>
        <input id={`start-${doctor.id}`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <span aria-hidden="true">–</span>
        <label className="sr-only" htmlFor={`end-${doctor.id}`}>
          End time
        </label>
        <input id={`end-${doctor.id}`} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        <button className="btn btn-small btn-secondary" type="submit">
          + Add window
        </button>
      </form>
    </div>
  );
}

function DoctorForm({ departments, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/doctors', {
        fullName,
        specialty,
        departmentId: Number(departmentId),
        bio: bio || undefined,
      });
      setFullName('');
      setSpecialty('');
      setBio('');
      onCreated(data.doctor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
      <h3 className="section-title" style={{ marginBottom: 12 }}>
        Add a dentist
      </h3>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="grid grid-2">
        <label className="field">
          <span>Full name</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Jane Smith" required />
        </label>
        <label className="field">
          <span>Specialty</span>
          <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} required />
        </label>
        <label className="field">
          <span>Department</span>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
            <option value="" disabled>
              Select a department
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Bio (optional)</span>
          <input value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
      </div>
      <button className="btn btn-primary" type="submit" disabled={submitting || departments.length === 0}>
        {submitting ? 'Adding…' : '+ Add dentist'}
      </button>
    </form>
  );
}

export default function ManageDirectoryPage() {
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadDepartments();
    loadDoctors();
  }, []);

  function loadDepartments() {
    api.get('/departments').then((data) => setDepartments(data.departments));
  }

  function loadDoctors() {
    api.get('/doctors').then((data) => setDoctors(data.doctors));
  }

  async function handleDeactivate(doctorId) {
    await api.del(`/doctors/${doctorId}`);
    loadDoctors();
  }

  return (
    <AppLayout>
      <div className="page-body page-body-wide">
        <h1 className="page-title">Manage Directory</h1>
        <p className="page-subtitle">Departments and dentists — this feeds Floss Clinic's assistant automatically.</p>

        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Departments ({departments.length})</h2>
          </div>
          <DepartmentForm onCreated={() => loadDepartments()} />
          <div className="grid grid-3">
            {departments.map((d) => (
              <DepartmentCard key={d.id} department={d} onUpdated={() => loadDepartments()} onDeleted={() => loadDepartments()} />
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Dentists ({doctors?.length ?? '…'})</h2>
          </div>
          <DoctorForm departments={departments} onCreated={() => loadDoctors()} />

          {doctors === null ? (
            <div className="skeleton skeleton-card" role="status" aria-live="polite">
              <span className="sr-only">Loading…</span>
            </div>
          ) : (
            <div className="list-col">
              {doctors.map((doc) => (
                <div key={doc.id} className="card card-hover">
                  <div className="appointment-card" style={{ border: 'none', padding: 0 }}>
                    <div className="appointment-main">
                      <span className="appointment-doctor">{doc.fullName}</span>
                      <span className="appointment-time">
                        {doc.specialty} · {doc.departmentName}
                      </span>
                    </div>
                    <div className="appointment-actions">
                      <button className="btn btn-small btn-secondary" onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}>
                        {expandedId === doc.id ? 'Hide availability' : 'Manage availability'}
                      </button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDeactivate(doc.id)}>
                        Deactivate
                      </button>
                    </div>
                  </div>
                  {expandedId === doc.id && <AvailabilityEditor doctor={doc} onChange={loadDoctors} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
