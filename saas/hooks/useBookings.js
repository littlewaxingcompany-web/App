import { useEffect, useState } from 'react';

/**
 * Fetch bookings for a salon from the API. Minimal client-side data hook.
 *
 * @param {string} salonId
 */
export function useBookings(salonId) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!salonId) return;
    setLoading(true);
    fetch(`/api/bookings?salon_id=${encodeURIComponent(salonId)}`)
      .then((r) => r.json())
      .then((data) => setBookings(data.bookings || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [salonId]);

  return { bookings, loading, error };
}
