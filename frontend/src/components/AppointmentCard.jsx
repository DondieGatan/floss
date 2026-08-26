function formatWhen(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = `${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  return `${dateLabel} · ${timeLabel}`;
}

export default function AppointmentCard({ appointment, showPatient = false, onCancel, onReschedule }) {
  const canCancel = onCancel && appointment.status === 'scheduled';
  const canReschedule = onReschedule && appointment.status === 'scheduled';

  return (
    <div className={`appointment-card status-${appointment.status}`}>
      <div className="appointment-main">
        <span className="appointment-doctor">
          {showPatient ? appointment.patientName : `Dr. ${appointment.doctorName?.replace(/^Dr\.?\s*/, '')}`}
        </span>
        <span className="appointment-time">{formatWhen(appointment.scheduledStart, appointment.scheduledEnd)}</span>
        {appointment.reason && <span className="appointment-reason">{appointment.reason}</span>}
        {showPatient && <span className="appointment-reason">with Dr. {appointment.doctorName?.replace(/^Dr\.?\s*/, '')}</span>}
      </div>
      <div className="appointment-actions">
        <span className={`status-badge status-badge-${appointment.status}`}>{appointment.status.replace('_', ' ')}</span>
        {canReschedule && (
          <button className="btn btn-small btn-secondary" onClick={() => onReschedule(appointment)}>
            Edit
          </button>
        )}
        {canCancel && (
          <button className="btn btn-small btn-danger" onClick={() => onCancel(appointment)}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
