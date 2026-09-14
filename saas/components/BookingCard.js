/**
 * Render a single booking record.
 */
export default function BookingCard({ booking }) {
  return (
    <div className="card">
      <strong>{booking.client_name || 'Unnamed client'}</strong>
      <span className="muted"> — {booking.service || 'No service'}</span>
      <p className="muted" style={{ margin: '0.5rem 0 0' }}>
        {[booking.date_appointment, booking.time_appointment, booking.location]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {booking.client_phone ? <p style={{ margin: '0.5rem 0 0' }}>📱 {booking.client_phone}</p> : null}
    </div>
  );
}
