import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import { getDoctorPhoto } from '../data/doctorPhotos';

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function DoctorsPage() {
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState(null);
  const [departmentId, setDepartmentId] = useState('');

  useEffect(() => {
    api.get('/departments').then((data) => setDepartments(data.departments));
  }, []);

  useEffect(() => {
    setDoctors(null);
    const query = departmentId ? `?departmentId=${departmentId}` : '';
    api.get(`/doctors${query}`).then((data) => setDoctors(data.doctors));
  }, [departmentId]);

  return (
    <AppLayout>
      <div className="page-body page-body-wide">
        <h1 className="page-title">Dentists</h1>
        <p className="page-subtitle">Browse our care teams and book an appointment.</p>

        <div className="filter-row">
          <label className="sr-only" htmlFor="department-filter">
            Department
          </label>
          <select id="department-filter" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {doctors === null ? (
          <div className="grid grid-3" role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        ) : doctors.length === 0 ? (
          <div className="empty-state">
            <p>No doctors found for this department yet.</p>
          </div>
        ) : (
          <div className="grid grid-3 stagger-in">
            {doctors.map((doc) => {
              const photo = getDoctorPhoto(doc.fullName);
              return (
              <div key={doc.id} className="doctor-card card-hover">
                {photo ? (
                  <img src={photo} alt="" className="doctor-avatar doctor-avatar-photo" />
                ) : (
                  <div className="doctor-avatar">{initials(doc.fullName)}</div>
                )}
                <p className="doctor-name">{doc.fullName}</p>
                <p className="doctor-specialty">{doc.specialty}</p>
                <p className="doctor-dept">{doc.departmentName}</p>
                {doc.bio && <p className="doctor-bio">{doc.bio}</p>}
                <Link className="btn btn-primary btn-small" to={`/doctors/${doc.id}/book`} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                  Book appointment
                </Link>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
