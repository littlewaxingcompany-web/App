import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import BookingCard from '../components/BookingCard';
import { useBookings } from '../hooks/useBookings';

/**
 * Dashboard — lists bookings for the owner's salon. If the owner has no salon
 * yet (e.g. a fresh account), redirect them into the onboarding flow.
 */
export default function Dashboard() {
  const router = useRouter();
  const [salon, setSalon] = useState(null);
  const [checking, setChecking] = useState(true);
  const { bookings, loading, error } = useBookings(salon?.id);

  useEffect(() => {
    let active = true;

    const userId =
      typeof window !== 'undefined' ? localStorage.getItem('salonstream.userId') : null;

    if (!userId) {
      router.replace('/onboarding');
      return () => {
        active = false;
      };
    }

    fetch(`/api/salons?user_id=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.salons && data.salons.length > 0) {
          setSalon(data.salons[0]);
        } else {
          router.replace('/onboarding');
        }
      })
      .catch(() => {
        if (active) router.replace('/onboarding');
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (checking) {
    return (
      <Layout title="Dashboard">
        <p className="muted">Loading…</p>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard">
      {salon ? (
        <p className="muted">
          Bookings for <strong>{salon.name}</strong>, processed from your Ovatu
          booking emails.
        </p>
      ) : null}

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
