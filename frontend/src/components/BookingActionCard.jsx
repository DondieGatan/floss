/**
 * A request the booking assistant has proposed. It shows exactly what would
 * change and nothing happens until the patient presses Confirm.
 */
export default function BookingActionCard({ action, onConfirm, onReject }) {
  return (
    <div className="booking-action-card" role="group" aria-label="Request waiting for your confirmation">
      <p className="booking-action-label">Waiting for your confirmation</p>
      <p className="booking-action-summary">{action.summary}</p>
      <div className="booking-action-buttons">
        <button type="button" className="btn btn-primary" onClick={() => onConfirm(action.id)} disabled={action.busy}>
          {action.busy ? 'Working…' : 'Confirm'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => onReject(action.id)} disabled={action.busy}>
          Not now
        </button>
      </div>
    </div>
  );
}
