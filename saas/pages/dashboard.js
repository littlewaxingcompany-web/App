import Layout from '../components/Layout';
import BookingCard from '../components/BookingCard';
import { useBookings } from '../hooks/useBookings';

/**
 * Dashboard — lists bookings for a salon. This is a scaffold page; wire the
 * salon id to the authenticated user's salon in production.
 */
export default function Dashboard() {
  // Placeholder salon id for the scaffold (replace with the user's salon).
  const { bookings, loading, error } = useBookings('demo-salon-id');

  return (
    <Layout title="Dashboard">
      <p className="muted">
        Bookings processed from your Ovatu booking emails. This is a scaffold —
        connect Supabase and pass the authenticated user's salon id to see live data.
      </p>

      {error ? <div className="card">Error: {error}</div> : null}
      {loading ? <div className="muted">Loading…</div> : null}

      {!loading && !error && bookings.length === 0 ? (
        <div className="card muted">No bookings yet.</div>
      ) : null}

      <div className="grid">
        {bookings.map((b) => (
          <BookingCard key={b.id} booking={b} />
        ))}
      </div>
    </Layout>
  );
}
